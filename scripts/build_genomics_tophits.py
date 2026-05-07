#!/usr/bin/env python3
"""Extract genome-wide-significant top-hit SNPs from PGC sumstats files.

For each disorder we care about, picks the canonical "best" cohort
(prefer no-23andMe + no-UKBB + most recent year), streams the
sumstats file, normalizes column names to a unified schema, filters
to genome-wide significance (p < 5e-8 by default), and writes a
small per-disorder TSV plus a combined "all top hits" TSV to the
vault.

Goals
- Make the data queryable without re-globbing 24 GB.
- Use 23andMe-excluding cohorts so a future cross-reference with
  Dave's own 23andMe variants isn't circular.
- Standardize columns so disorder-by-disorder comparison is trivial:
    rsid, chr, pos, effect_allele, other_allele, beta, se, p, n,
    disorder, source_file

Idempotent. Safe to extend with more disorders.

Usage:
    python scripts/build_genomics_tophits.py
    python scripts/build_genomics_tophits.py --p-threshold 5e-8 --top-n 10000
    python scripts/build_genomics_tophits.py --disorder MDD --p-threshold 1e-6
"""

from __future__ import annotations

import argparse
import bz2
import gzip
import json
import math
import os
import sys
from datetime import datetime, timezone

DEFAULT_PGC_DIR = os.path.expanduser("~/Downloads/psychiatric_genomics_consortium_data")
DEFAULT_VAULT = os.path.expanduser("~/Documents/Remote Vault")
DEFAULT_OUT_REL = "wiki/genomics/top_hits"

# Standard output schema. Columns we always emit, in this order.
# `z` is included so files that report only Z-scores (CUD, OUD, alcdep) can
# still feed a PRS — sign+magnitude is what the dosage-weighted sum needs.
STANDARD_COLS = [
    "rsid",
    "chr",
    "pos",
    "effect_allele",
    "other_allele",
    "freq_effect",
    "beta",
    "or",
    "z",
    "se",
    "p",
    "n_eff",
    "info",
]

# Map of source-column-name (lowercase) → standard-column-name.
# The dict has overlapping aliases; first match wins per column.
COLUMN_ALIASES = {
    # rsid / variant identifier
    "rsid": "rsid", "snp": "rsid", "id": "rsid", "markername": "rsid", "variant_id": "rsid",
    # chromosome
    "chr": "chr", "chrom": "chr", "chromosome": "chr", "#chrom": "chr",
    # base-pair position
    "pos": "pos", "bp": "pos", "position": "pos", "base_pair_location": "pos",
    # effect allele (the allele the BETA/OR/Z is measured against)
    "ea": "effect_allele", "a1": "effect_allele", "effect_allele": "effect_allele", "allele1": "effect_allele", "alt": "effect_allele", "a_1": "effect_allele",
    # other / reference allele
    "nea": "other_allele", "a2": "other_allele", "other_allele": "other_allele", "allele2": "other_allele", "ref": "other_allele", "a_0": "other_allele",
    # effect-allele frequency
    "freq": "freq_effect", "frq": "freq_effect", "eaf": "freq_effect", "frq_a": "freq_effect", "maf": "freq_effect",
    "effect_allele_freq": "freq_effect", "effect_allele_frequency": "freq_effect", "freq_effect": "freq_effect",
    "fcon": "freq_effect",  # PGC3 control AF — use as population EAF proxy
    # effect size
    "beta": "beta", "b": "beta", "effect": "beta", "log_odds": "beta",
    "or": "or", "odds_ratio": "or",
    "z": "z", "zscore": "z", "z_score": "z", "z-score": "z",
    # standard error
    "se": "se", "stderr": "se", "standard_error": "se",
    # p-value
    "p": "p", "pval": "p", "pvalue": "p", "p_value": "p", "p-value": "p",
    # effective N (or per-row N if present)
    "neff": "n_eff", "n_eff": "n_eff", "n_effective": "n_eff", "n": "n_eff", "ntotal": "n_eff",
    "weight": "n_eff", "total_n": "n_eff",
    # imputation info
    "info": "info", "impinfo": "info", "info_score": "info", "imputation_info": "info",
}

# Some files use multi-suffix column names where one suffix is the canonical
# variant we want. AUDIT_UKB has beta_T (total), beta_C (consumption),
# beta_P (problems) — we want T. Map filename→{std_col: source_col_name}.
FILE_COLUMN_OVERRIDES = {
    "AUDIT_UKB_2018_AJP.txt.gz": {
        "rsid": "rsid",
        "chr": "chr",
        "effect_allele": "a_1",
        "other_allele": "a_0",
        "info": "info",
        "beta": "beta_T",
        "se": "se_T",
        "p": "p_T",
        "n_eff": "n",
    },
}


# Canonical "best" file per disorder, in priority order.
# First entry that exists on disk wins.
DISORDER_TARGETS = {
    "MDD": [
        "pgc-mdd2025_no23andMe-noUKBB_eur_v3-49-24-11.tsv.gz",
        "pgc-mdd2025_no23andMe_eur_v3-49-24-11.tsv.gz",
        "daner_pgc_mdd_meta_w2_no23andMe_rmUKBB.gz",
        "MDD2018_ex23andMe.gz",
    ],
    "bipolar": [
        "bip2024_eur_noUKB_no23andMe.gz",
        "bip2024_eur_no23andMe.gz",
        "bip2024_multianc_no23andMe.gz",
    ],
    "OCD": [
        "daner_OCDmeta_wo23andMe_LOOUKBB_080425.gz",
        "daner_OCD_full_wo23andMe_190522.gz",
    ],
    "schizophrenia": [
        # Wave 3 (Trubetskoy 2022, 76K cases, no 23andMe) — preferred
        "PGC3_SCZ_wave3.european.autosome.public.v3.vcf.tsv.gz",
        # Older Ripke 2014 (SCZ52, 36K cases) — fallback
        "daner_PGC_SCZ52_0513a.hq2.gz",
    ],
    "schizophrenia_eas": [
        "daner_natgen_pgc_eas.gz",  # Lam et al 2019, EAS-only SCZ
    ],
    "cannabis_use_disorder": [
        "CUD_EUR_full_public_11.14.2020.gz",
    ],
    "alcohol_dependence": [
        "pgc_alcdep.eur_discovery.aug2018_release.txt.gz",
    ],
    "alcohol_use_audit": [
        "AUDIT_UKB_2018_AJP.txt.gz",  # UK Biobank AUDIT total score
    ],
    "opioid_use_disorder": [
        "OD_cases_vs._opioid-exposed_controls_in_European-ancestry_cohorts.gz",
    ],
    "ADHD": [
        "ADHD2022_iPSYCH_deCODE_PGC.meta.gz",
    ],
    "ASD": [
        "iPSYCH-PGC_ASD_Nov2017.gz",
    ],
    "PTSD": [
        "pts_eur_freeze2_overall.results.gz",
    ],
    "anxiety": [
        "ANX_2026_daner_fullANX_v12_woUTAH_11022026.gz",
    ],
    "p_factor": ["PFactor_2025.tsv.gz"],
    "F1_compulsive_factor": ["F1_CompulsiveDisorders_2025.tsv.gz"],
    "F2_psychosis_factor": ["F2_SchizophreniaBipolar_2025.tsv.gz"],
    "F3_neurodev_factor": ["F3_Neurodevelopmental_2025.tsv.gz"],
    "F4_internalizing_factor": ["F4_Internalizing_2025.tsv.gz"],
    "F5_substance_factor": ["F5_SubstanceUse_2025.tsv.gz"],
}


def _open(path):
    """Return a text-mode handle for .gz / .bz2 / plain files."""
    name = path.lower()
    if name.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    if name.endswith(".bz2"):
        return bz2.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def _read_metadata_and_header(fh):
    """Skip ## comment lines, return the column header line.

    Also accumulates ## metadata into a dict for the manifest.
    """
    metadata = {}
    for raw in fh:
        line = raw.rstrip("\n").rstrip("\r")
        if not line.strip():
            continue
        if line.startswith("##"):
            # Pattern: ##key=value or ##key="value"
            kv = line.lstrip("#").strip()
            if "=" in kv:
                k, v = kv.split("=", 1)
                metadata[k.strip().lower()] = v.strip().strip('"')
            continue
        # The column header itself may start with a single `#` (VCF-ish)
        return line.lstrip("#").strip(), metadata
    return None, metadata


def _build_column_map(header_fields, override_basename=None):
    """Map source column names to our standard schema names.

    If `override_basename` matches FILE_COLUMN_OVERRIDES, the mapping for
    that file is built explicitly from the override dict instead of
    relying on alias auto-detection (used for AUDIT-style files where
    multiple suffix variants of the same statistic exist).

    Returns column_map: dict[std_name -> source_index]
    """
    lower_fields = [c.strip().lower() for c in header_fields]
    cmap = {}

    overrides = FILE_COLUMN_OVERRIDES.get(override_basename or "")
    if overrides:
        for std_name, src_col in overrides.items():
            try:
                cmap[std_name] = lower_fields.index(src_col.lower())
            except ValueError:
                pass
        return cmap

    for i, col in enumerate(lower_fields):
        canon = COLUMN_ALIASES.get(col)
        # Don't overwrite a previously-found mapping (column order isn't
        # uniform across files, so first hit wins).
        if canon and canon not in cmap:
            cmap[canon] = i
    return cmap


def _coerce_float(s):
    if s is None or s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _coerce_int(s):
    if s is None or s == "":
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def extract_top_hits(path, p_threshold=5e-8, top_n=20000, verbose=False):
    """Stream a sumstats file, extract rows with p < p_threshold (up to top_n),
    return (rows, metadata, column_map, total_scanned).
    """
    with _open(path) as fh:
        header_line, metadata = _read_metadata_and_header(fh)
        if not header_line:
            return [], metadata, {}, 0

        fields = header_line.split("\t") if "\t" in header_line else header_line.split()
        cmap = _build_column_map(fields, override_basename=os.path.basename(path))

        if "p" not in cmap:
            raise RuntimeError(
                f"Could not locate p-value column. Header was: {fields[:20]}"
            )
        p_idx = cmap["p"]

        rows = []
        scanned = 0
        for raw in fh:
            line = raw.rstrip("\n").rstrip("\r")
            if not line or line.startswith("#"):
                continue
            scanned += 1
            parts = line.split("\t") if "\t" in line else line.split()
            if len(parts) <= p_idx:
                continue
            try:
                p = float(parts[p_idx])
            except ValueError:
                continue
            if p > p_threshold:
                continue

            # Build standard-schema row.
            row = {"_p": p}
            for std_name, src_idx in cmap.items():
                if src_idx < len(parts):
                    row[std_name] = parts[src_idx]
            rows.append(row)

            if verbose and scanned % 1_000_000 == 0:
                print(f"    scanned {scanned:,} rows; kept {len(rows):,}", file=sys.stderr)

        # Sort by p ascending, keep top_n.
        rows.sort(key=lambda r: r["_p"])
        if len(rows) > top_n:
            rows = rows[:top_n]

        return rows, metadata, cmap, scanned


def write_tsv(rows, path, source_file, disorder, metadata):
    """Write rows in the standard schema to a TSV with provenance header."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        # Provenance comment block (lines starting with `#` are easy to skip).
        f.write(f"# disorder: {disorder}\n")
        f.write(f"# source_file: {source_file}\n")
        f.write(f"# generated_at: {datetime.now(timezone.utc).isoformat()}\n")
        for k in (
            "shortname", "version", "referencepopulation",
            "dependentvariable", "ncase", "ncontrol", "neffective", "nvariants",
            "doi", "genomereference",
        ):
            if k in metadata:
                f.write(f"# {k}: {metadata[k]}\n")
        f.write("\t".join(STANDARD_COLS) + "\n")
        for row in rows:
            out = [row.get(c, "") for c in STANDARD_COLS]
            f.write("\t".join(out) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pgc-dir", default=DEFAULT_PGC_DIR)
    ap.add_argument("--vault", default=DEFAULT_VAULT)
    ap.add_argument("--out-rel", default=DEFAULT_OUT_REL)
    ap.add_argument("--p-threshold", type=float, default=5e-8,
                    help="keep SNPs with p below this (default: 5e-8 = genome-wide significant)")
    ap.add_argument("--top-n", type=int, default=20000,
                    help="cap rows per file after p-filtering (default 20000)")
    ap.add_argument("--disorder", default=None,
                    help="run only this disorder (default: all in DISORDER_TARGETS)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    targets = (
        {args.disorder: DISORDER_TARGETS[args.disorder]}
        if args.disorder
        else DISORDER_TARGETS
    )
    if args.disorder and args.disorder not in DISORDER_TARGETS:
        sys.exit(f"unknown disorder: {args.disorder}; known: {sorted(DISORDER_TARGETS)}")

    out_dir = os.path.join(args.vault, args.out_rel)
    os.makedirs(out_dir, exist_ok=True)

    summary = []
    combined_rows = []

    for disorder, candidates in targets.items():
        chosen = None
        for fn in candidates:
            full = os.path.join(args.pgc_dir, fn)
            if os.path.isfile(full):
                chosen = full
                break
        if not chosen:
            print(f"[skip] {disorder}: none of {candidates} found", file=sys.stderr)
            continue

        if args.verbose:
            print(f"[{disorder}] reading {os.path.basename(chosen)}…", file=sys.stderr)

        try:
            rows, metadata, cmap, scanned = extract_top_hits(
                chosen, p_threshold=args.p_threshold, top_n=args.top_n,
                verbose=args.verbose,
            )
        except Exception as e:
            print(f"[error] {disorder}: {e}", file=sys.stderr)
            continue

        out_path = os.path.join(out_dir, f"{disorder}.tsv")
        write_tsv(rows, out_path, os.path.basename(chosen), disorder, metadata)

        for r in rows:
            combined_rows.append({"disorder": disorder, **r, "source_file": os.path.basename(chosen)})

        kept = len(rows)
        summary.append({
            "disorder": disorder,
            "source_file": os.path.basename(chosen),
            "scanned": scanned,
            "significant": kept,
            "metadata": {k: metadata[k] for k in metadata if k in {
                "shortname", "version", "referencepopulation", "ncase",
                "ncontrol", "neffective", "nvariants",
            }},
        })
        print(f"  {disorder}: {scanned:,} scanned, {kept:,} kept (p<{args.p_threshold})")

    # Combined view: all top-hits across disorders, sorted by p ascending.
    if combined_rows:
        combined_rows.sort(key=lambda r: r.get("_p") or 1.0)
        combined_path = os.path.join(out_dir, "_all_disorders.tsv")
        with open(combined_path, "w", encoding="utf-8") as f:
            f.write(f"# generated_at: {datetime.now(timezone.utc).isoformat()}\n")
            f.write(f"# p_threshold: {args.p_threshold}\n")
            f.write(f"# disorders: {','.join(sorted({r['disorder'] for r in combined_rows}))}\n")
            cols = ["disorder", "source_file"] + STANDARD_COLS
            f.write("\t".join(cols) + "\n")
            for r in combined_rows:
                out = [str(r.get(c, "")) for c in cols]
                f.write("\t".join(out) + "\n")

    # Summary index in JSON for future iterations.
    summary_path = os.path.join(out_dir, "_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "p_threshold": args.p_threshold,
            "top_n": args.top_n,
            "out_dir": out_dir,
            "results": summary,
        }, f, indent=2)
    print(f"\nWrote {len(summary)} per-disorder TSVs + _all_disorders.tsv + _summary.json to {out_dir}")


if __name__ == "__main__":
    main()
