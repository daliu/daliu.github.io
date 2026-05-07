#!/usr/bin/env python3
"""Compute MHC-stratified centered chip-PRS for one disorder GWAS.

Given a GWAS summary-statistics file (PGC daner format or PGC sumstats
VCF format) and a 23andMe v5 raw genotype file, this script computes:

- Coverage: how many GWAS GWS SNPs (p < 5e-8) are typed by the chip
- Centered PRS = sum_i beta_i * (d_i - 1) over typed-and-aligned SNPs,
  where d_i in {0, 1, 2} is effect-allele dosage. Positive = subject
  enriched for effect alleles relative to heterozygous-everywhere
  baseline; negative = depleted.
- MHC-partitioned centered PRS: same calculation restricted to chr 6
  25-34 Mb (MHC) and to non-MHC SNPs separately.

This is the analysis that backs the "single-subject chip-PRS MHC
dominance" findings in research/genomics-mhc-paper/paper.tex. The
paper reports specific numbers (e.g. PGC3 wave 3 EUR SCZ: +60.33 full,
-0.67 non-MHC) that this script reproduces given the sumstats file.

Usage:
    python scripts/build_genomics_chip_prs_mhc.py \\
        --sumstats ~/Downloads/PGC3_SCZ_wave3.european.autosome.public.v3.vcf.tsv.gz \\
        --genotype ~/Downloads/genome_<name>_v5_Full_<hash>.txt \\
        --label "PGC3 wave 3 EUR"

Sumstats files supported: PGC daner (CHR/SNP/BP/A1/A2/OR/SE/P/...) and
PGC VCF-as-TSV (## metadata followed by CHROM/ID/POS/A1/A2/.../BETA/...).
Z-score-only files are handled by treating Z as a signed effect-size proxy.

The chip-typed input is filtered for biallelic ACGT genotypes only;
indels (II/DD/DI), no-calls (--), and non-ACGT entries are skipped.
Strand-mismatched SNPs (where the subject's observed alleles aren't a
subset of the GWAS effect+other alleles) are skipped, not flipped.

MHC region: chr 6: 25-34 Mb (GRCh37). This is the extended MHC,
spanning the classical class-I/II/III region with a buffer.
"""

from __future__ import annotations

import argparse
import bz2
import gzip
import math
import os
import sys

# Standard column aliases per the unified-schema convention used by
# scripts/build_genomics_tophits.py. First-match-wins.
COL_ALIASES = {
    "rsid": "rsid", "snp": "rsid", "id": "rsid", "markername": "rsid", "variant_id": "rsid",
    "chr": "chr", "chrom": "chr", "chromosome": "chr", "#chrom": "chr",
    "pos": "pos", "bp": "pos", "position": "pos", "base_pair_location": "pos",
    "ea": "effect_allele", "a1": "effect_allele", "effect_allele": "effect_allele",
    "allele1": "effect_allele", "alt": "effect_allele",
    "nea": "other_allele", "a2": "other_allele", "other_allele": "other_allele",
    "allele2": "other_allele", "ref": "other_allele",
    "beta": "beta", "b": "beta", "effect": "beta", "log_odds": "beta",
    "or": "or", "odds_ratio": "or",
    "z": "z", "zscore": "z", "z_score": "z",
    "p": "p", "pval": "p", "pvalue": "p", "p_value": "p", "p-value": "p",
}

# Chr 6 extended MHC region (GRCh37/hg19, 1-based)
MHC_CHR = "6"
MHC_START_BP = 25_000_000
MHC_END_BP = 34_000_000


def _open(path):
    name = path.lower()
    if name.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    if name.endswith(".bz2"):
        return bz2.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def _read_header(fh):
    """Skip ## VCF-style metadata, return the column header line."""
    for raw in fh:
        line = raw.rstrip("\n").rstrip("\r")
        if not line.strip():
            continue
        if line.startswith("##"):
            continue
        return line.lstrip("#").strip()
    return None


def _column_map(header_fields):
    cmap = {}
    for i, col in enumerate(header_fields):
        canon = COL_ALIASES.get(col.strip().lower())
        if canon and canon not in cmap:
            cmap[canon] = i
    return cmap


def _safe_float(s):
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def load_genotypes(path):
    """Return dict[rsid -> (a1, a2)] from a 23andMe TSV."""
    geno = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.rstrip("\n").rstrip("\r").split("\t")
            if len(parts) < 4:
                continue
            rsid, _chrom, _pos, gt = parts[0], parts[1], parts[2], parts[3]
            if gt in ("--", "00") or "D" in gt or "I" in gt or len(gt) != 2:
                continue
            if gt[0] not in "ACGT" or gt[1] not in "ACGT":
                continue
            geno[rsid] = (gt[0], gt[1])
    return geno


def compute_prs(sumstats_path, geno, p_threshold=5e-8, verbose=False):
    """Stream a sumstats file, intersect with genotypes, compute PRS.

    Returns a dict with full / mhc / non_mhc summaries.
    """
    with _open(sumstats_path) as fh:
        header_line = _read_header(fh)
        if not header_line:
            sys.exit(f"empty header in {sumstats_path}")
        fields = header_line.split("\t") if "\t" in header_line else header_line.split()
        cmap = _column_map(fields)
        for required in ("rsid", "effect_allele", "other_allele", "p"):
            if required not in cmap:
                sys.exit(f"required column not found: {required} (header: {fields[:15]})")

        # bucket = {"matched": int, "carrier": int, "homo": int, "sum_b": float, "sum_bd": float}
        def _new_bucket():
            return {"matched": 0, "carrier": 0, "homo": 0, "sum_b": 0.0, "sum_bd": 0.0}
        b_full = _new_bucket()
        b_mhc = _new_bucket()
        b_non_mhc = _new_bucket()

        scanned = 0
        gws_count = 0
        for raw in fh:
            line = raw.rstrip("\n").rstrip("\r")
            if not line or line.startswith("#"):
                continue
            scanned += 1
            parts = line.split("\t") if "\t" in line else line.split()
            if len(parts) <= cmap["p"]:
                continue
            p = _safe_float(parts[cmap["p"]])
            if p is None or p > p_threshold:
                continue
            gws_count += 1

            rsid = parts[cmap["rsid"]]
            if not rsid.startswith("rs"):
                continue
            if rsid not in geno:
                continue

            ea = parts[cmap["effect_allele"]].upper()
            oa = parts[cmap["other_allele"]].upper()
            if ea not in "ACGT" or oa not in "ACGT":
                continue

            a1, a2 = geno[rsid]
            if not {a1, a2}.issubset({ea, oa}):
                continue  # strand mismatch

            # Effect size: prefer beta, then log(or), then z
            beta = None
            if "beta" in cmap and cmap["beta"] < len(parts):
                beta = _safe_float(parts[cmap["beta"]])
            if beta is None and "or" in cmap and cmap["or"] < len(parts):
                oratio = _safe_float(parts[cmap["or"]])
                if oratio and oratio > 0:
                    beta = math.log(oratio)
            if beta is None and "z" in cmap and cmap["z"] < len(parts):
                beta = _safe_float(parts[cmap["z"]])
            if beta is None:
                continue

            d = (a1 == ea) + (a2 == ea)

            # Determine MHC membership
            in_mhc = False
            if "chr" in cmap and "pos" in cmap and cmap["chr"] < len(parts) and cmap["pos"] < len(parts):
                chrom = str(parts[cmap["chr"]])
                pos_str = parts[cmap["pos"]]
                try:
                    pos_bp = int(pos_str)
                except ValueError:
                    pos_bp = None
                if chrom == MHC_CHR and pos_bp and MHC_START_BP <= pos_bp <= MHC_END_BP:
                    in_mhc = True

            def _update(b):
                b["matched"] += 1
                b["sum_b"] += beta
                b["sum_bd"] += beta * d
                if d >= 1: b["carrier"] += 1
                if d == 2: b["homo"] += 1

            _update(b_full)
            (_update(b_mhc) if in_mhc else _update(b_non_mhc))

            if verbose and scanned % 1_000_000 == 0:
                print(f"  scanned {scanned:,} rows; {gws_count:,} GWS hits; "
                      f"{b_full['matched']:,} typed", file=sys.stderr)

    def _summary(b):
        return {
            "matched": b["matched"],
            "n_carrier": b["carrier"],
            "n_homo": b["homo"],
            "centered_prs": round(b["sum_bd"] - b["sum_b"], 4),
            "sum_beta_dosage": round(b["sum_bd"], 4),
        }

    return {
        "scanned": scanned,
        "gws_count": gws_count,
        "full": _summary(b_full),
        "mhc": _summary(b_mhc),
        "non_mhc": _summary(b_non_mhc),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sumstats", required=True, help="GWAS summary-stats file (gz/bz2/plain)")
    ap.add_argument("--genotype", required=True, help="23andMe v5 raw download")
    ap.add_argument("--p-threshold", type=float, default=5e-8)
    ap.add_argument("--label", default=None, help="Display label for this analysis")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    if not os.path.isfile(args.sumstats):
        sys.exit(f"sumstats not found: {args.sumstats}")
    if not os.path.isfile(args.genotype):
        sys.exit(f"genotype not found: {args.genotype}")

    label = args.label or os.path.basename(args.sumstats)

    print(f"=== {label} ===")
    print(f"Genotype:  {os.path.basename(args.genotype)}")
    print(f"Sumstats:  {os.path.basename(args.sumstats)}")
    print(f"Threshold: p < {args.p_threshold:.0e}")
    print(f"MHC defn:  chr {MHC_CHR}: {MHC_START_BP/1e6:.0f}-{MHC_END_BP/1e6:.0f} Mb (GRCh37)")
    print()

    geno = load_genotypes(args.genotype)
    print(f"Loaded {len(geno):,} usable biallelic SNPs from genotype")

    res = compute_prs(args.sumstats, geno, p_threshold=args.p_threshold, verbose=args.verbose)

    print()
    print(f"GWS SNPs (p < {args.p_threshold:.0e}):  {res['gws_count']:,}")
    print(f"Typed by chip (matched + aligned): {res['full']['matched']:,}  "
          f"({100*res['full']['matched']/res['gws_count']:.2f}% if any)")
    print()
    print(f"{'Partition':<12s} {'Typed':>8s} {'Carrier':>8s} {'Hom':>6s} {'Centered PRS':>13s}")
    for name in ("full", "mhc", "non_mhc"):
        s = res[name]
        print(f"  {name:<10s} {s['matched']:>8d} {s['n_carrier']:>8d} "
              f"{s['n_homo']:>6d} {s['centered_prs']:>+13.4f}")


if __name__ == "__main__":
    main()
