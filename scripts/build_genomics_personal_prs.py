#!/usr/bin/env python3
"""Cross-reference Dave's 23andMe genotypes against the per-disorder
GWS-significant top-hits indexed by build_genomics_tophits.py.

For each disorder:
- Load the per-disorder top-hits TSV (rsid / effect_allele / other_allele / beta / p)
- Intersect with Dave's genotypes by rsid
- For each matched SNP, compute dosage of the effect allele (0/1/2)
- Aggregate:
    coverage   = SNPs in the top-hits index that 23andMe also typed
    n_carrier  = SNPs where Dave has at least one effect allele
    n_homo     = SNPs where Dave is homozygous for the effect allele
    sum_beta_dosage = Σ (beta × dosage) — a simple unstandardized PRS
    mean_dosage     = average effect-allele dosage over matched SNPs
- Also identify the strongest-effect SNPs Dave actually carries.

Special cross-disorder pass:
- For SNPs flagged as transdiagnostic (≥3 disorders in the top-hits
  index), record Dave's carrier status. The chr 6 / MHC cluster found
  in the previous iteration goes here.

Inputs and outputs are kept private (vault), since this is personal
genotype data. Public site never sees the raw SNPs — at most we'd
publish aggregate scores or a per-disorder narrative summary.

Usage:
    python scripts/build_genomics_personal_prs.py
    python scripts/build_genomics_personal_prs.py --genotype PATH
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

DEFAULT_GENOTYPE = "/Users/daveliu/Downloads/genome_Dave_Liu_v5_Full_20220828070944.txt"
DEFAULT_VAULT = os.path.expanduser("~/Documents/Remote Vault")
DEFAULT_TOPHITS_REL = "wiki/genomics/top_hits"
DEFAULT_OUT_REL = "wiki/genomics/personal"


def load_genotypes(path):
    """Return dict[rsid → set('A','C','G','T')] (the two alleles) plus stats."""
    geno = {}
    n_total = 0
    n_skipped = 0
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if not line or line.startswith("#"):
                continue
            parts = line.rstrip("\n").rstrip("\r").split("\t")
            if len(parts) < 4:
                continue
            rsid, chrom, pos, gt = parts[0], parts[1], parts[2], parts[3]
            n_total += 1
            # Skip no-calls (--), indels (DD/DI/II), missing.
            if gt in ("--", "00") or "D" in gt or "I" in gt or len(gt) != 2:
                n_skipped += 1
                continue
            a1, a2 = gt[0], gt[1]
            if a1 not in "ACGT" or a2 not in "ACGT":
                n_skipped += 1
                continue
            geno[rsid] = {"a1": a1, "a2": a2, "chrom": chrom, "pos": pos}
    return geno, {"total_snps": n_total, "skipped": n_skipped, "usable": len(geno)}


def dosage(geno_entry, effect_allele):
    """Count copies of effect_allele in the genotype (0, 1, or 2)."""
    if not geno_entry:
        return None
    return int(geno_entry["a1"] == effect_allele) + int(geno_entry["a2"] == effect_allele)


def parse_tophits_tsv(path):
    """Yield dicts from a per-disorder TSV. Skips comment lines."""
    cols = None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n").rstrip("\r")
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if cols is None:
                cols = parts
                continue
            if len(parts) != len(cols):
                continue
            yield dict(zip(cols, parts))


def safe_float(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


# Conservative MHC/HLA region boundaries on chr 6 (GRCh37/hg19).
# 25–34 Mb spans the extended MHC, well beyond the classical 28.5–33.4 Mb
# class-I/II/III region. Used to flag SNPs whose contribution to the
# centered PRS is dominated by one long-range LD block.
MHC_CHR = "6"
MHC_START_MB = 25
MHC_END_MB = 34


def _is_mhc(chrom, pos):
    """Return True if (chrom, pos) is in the MHC region (chr 6: 25-34 Mb)."""
    if str(chrom) != MHC_CHR:
        return False
    try:
        bp = int(pos)
    except (TypeError, ValueError):
        return False
    return MHC_START_MB * 1_000_000 <= bp <= MHC_END_MB * 1_000_000


def analyze_disorder(disorder, tophits_path, geno):
    """Return per-disorder summary dict.

    Tracks two parallel sums: full (all GWS SNPs in the disorder index)
    and non_mhc (SNPs outside chr 6: 25-34 Mb). Reporting both lets
    readers see how much of the centered PRS comes from the MHC long-LD
    block — the single biggest source of LD inflation in psychiatric
    chip-PRS computation.
    """
    examined = 0
    # Per-bucket stats: 'all' = every matched SNP; 'non_mhc' = excludes chr6 MHC
    buckets = {
        "all":     {"matched": 0, "carrier": 0, "homo": 0, "sum_bd": 0.0, "sum_abs_bd": 0.0, "sum_b": 0.0, "dist": [0, 0, 0]},
        "non_mhc": {"matched": 0, "carrier": 0, "homo": 0, "sum_bd": 0.0, "sum_abs_bd": 0.0, "sum_b": 0.0, "dist": [0, 0, 0]},
    }
    strong_carriers = []

    for row in parse_tophits_tsv(tophits_path):
        examined += 1
        rsid = row.get("rsid", "")
        if not rsid or not rsid.startswith("rs"):
            continue
        ea = (row.get("effect_allele") or "").upper()
        oa = (row.get("other_allele") or "").upper()
        if ea not in "ACGT" or oa not in "ACGT":
            continue

        beta_str = row.get("beta") or ""
        or_str = row.get("or") or ""
        z_str = row.get("z") or ""
        beta = safe_float(beta_str)
        beta_kind = "beta"
        if beta is None and or_str:
            oratio = safe_float(or_str)
            if oratio and oratio > 0:
                import math
                beta = math.log(oratio)
                beta_kind = "log_or"
        if beta is None and z_str:
            beta = safe_float(z_str)
            beta_kind = "z"
        if beta is None:
            continue

        g = geno.get(rsid)
        if not g:
            continue

        observed = {g["a1"], g["a2"]}
        if not observed.issubset({ea, oa}):
            continue

        d = dosage(g, ea)
        in_mhc = _is_mhc(row.get("chr"), row.get("pos"))

        # Always update the 'all' bucket.
        b = buckets["all"]
        b["matched"] += 1
        b["dist"][d] += 1
        b["sum_bd"] += beta * d
        b["sum_abs_bd"] += abs(beta) * d
        b["sum_b"] += beta
        if d >= 1:
            b["carrier"] += 1
        if d == 2:
            b["homo"] += 1

        # Only update 'non_mhc' if the SNP is outside the MHC region.
        if not in_mhc:
            b = buckets["non_mhc"]
            b["matched"] += 1
            b["dist"][d] += 1
            b["sum_bd"] += beta * d
            b["sum_abs_bd"] += abs(beta) * d
            b["sum_b"] += beta
            if d >= 1:
                b["carrier"] += 1
            if d == 2:
                b["homo"] += 1

        threshold = 6.0 if beta_kind == "z" else 0.05
        if d >= 1 and abs(beta) > threshold:
            strong_carriers.append({
                "rsid": rsid,
                "chr": row.get("chr"),
                "pos": row.get("pos"),
                "effect_allele": ea,
                "other_allele": oa,
                "genotype": g["a1"] + g["a2"],
                "dosage": d,
                "beta": round(beta, 4),
                "beta_kind": beta_kind,
                "in_mhc": in_mhc,
                "p": row.get("p"),
            })

    strong_carriers.sort(key=lambda r: -abs(r["beta"]))

    def _summary(name):
        b = buckets[name]
        m = b["matched"]
        return {
            "matched": m,
            "n_carrier": b["carrier"],
            "n_homo": b["homo"],
            "mean_dosage": round((b["dist"][1] + 2 * b["dist"][2]) / m, 4) if m else None,
            "sum_beta_dosage": round(b["sum_bd"], 4),
            "sum_abs_beta_dosage": round(b["sum_abs_bd"], 4),
            "centered_prs": round(b["sum_bd"] - b["sum_b"], 4),
        }

    full = _summary("all")
    non_mhc = _summary("non_mhc")
    mhc_only = {
        "matched": full["matched"] - non_mhc["matched"],
        "n_carrier": full["n_carrier"] - non_mhc["n_carrier"],
        "n_homo": full["n_homo"] - non_mhc["n_homo"],
        "centered_prs": round(full["centered_prs"] - non_mhc["centered_prs"], 4),
    }

    return {
        "disorder": disorder,
        "tophits_examined": examined,
        "tophits_matched_in_23andMe": full["matched"],
        "n_carrier": full["n_carrier"],
        "n_homo": full["n_homo"],
        "dosage_distribution": {"0": buckets["all"]["dist"][0], "1": buckets["all"]["dist"][1], "2": buckets["all"]["dist"][2]},
        "mean_dosage": full["mean_dosage"],
        "sum_beta_dosage": full["sum_beta_dosage"],
        "sum_abs_beta_dosage": full["sum_abs_beta_dosage"],
        "ref_sum_beta_per_match": round(buckets["all"]["sum_b"], 4),
        "centered_prs": full["centered_prs"],
        # NEW — MHC-stratified centered PRS for robustness.
        "centered_prs_non_mhc": non_mhc["centered_prs"],
        "centered_prs_mhc_only": mhc_only["centered_prs"],
        "matched_non_mhc": non_mhc["matched"],
        "matched_mhc": mhc_only["matched"],
        "strong_carriers_top10": strong_carriers[:10],
    }


def transdiagnostic_carriers(tophits_dir, geno, min_disorders=3):
    """Return the SNPs that are GWS in ≥min_disorders disorders, with
    Dave's genotype/dosage info for each."""
    rsid_to_disorders = defaultdict(set)
    rsid_meta = {}  # cache: rsid → (effect_allele, other_allele, beta_avg)

    for fn in sorted(os.listdir(tophits_dir)):
        if fn.startswith("_") or not fn.endswith(".tsv"):
            continue
        disorder = fn[:-4]
        path = os.path.join(tophits_dir, fn)
        for row in parse_tophits_tsv(path):
            rsid = row.get("rsid", "")
            if not rsid.startswith("rs"):
                continue
            rsid_to_disorders[rsid].add(disorder)
            if rsid not in rsid_meta:
                rsid_meta[rsid] = {
                    "ea": (row.get("effect_allele") or "").upper(),
                    "oa": (row.get("other_allele") or "").upper(),
                    "chr": row.get("chr"),
                    "pos": row.get("pos"),
                }

    multi = []
    for rsid, ds in rsid_to_disorders.items():
        if len(ds) < min_disorders:
            continue
        meta = rsid_meta[rsid]
        g = geno.get(rsid)
        d = dosage(g, meta["ea"]) if g and meta["ea"] in "ACGT" else None
        observed = (g["a1"] + g["a2"]) if g else None
        if g and meta["ea"] not in "ACGT":
            d = None
        if g and observed and meta["ea"] in "ACGT" and meta["oa"] in "ACGT":
            obs_set = {g["a1"], g["a2"]}
            if not obs_set.issubset({meta["ea"], meta["oa"]}):
                d = None  # strand mismatch
        multi.append({
            "rsid": rsid,
            "chr": meta.get("chr"),
            "pos": meta.get("pos"),
            "n_disorders": len(ds),
            "disorders": sorted(ds),
            "effect_allele": meta["ea"],
            "other_allele": meta["oa"],
            "in_23andMe": g is not None,
            "genotype": observed,
            "dosage": d,
        })
    multi.sort(key=lambda r: (-r["n_disorders"], r["rsid"]))
    return multi


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--genotype", default=DEFAULT_GENOTYPE)
    ap.add_argument("--vault", default=DEFAULT_VAULT)
    ap.add_argument("--tophits-rel", default=DEFAULT_TOPHITS_REL)
    ap.add_argument("--out-rel", default=DEFAULT_OUT_REL)
    args = ap.parse_args()

    if not os.path.isfile(args.genotype):
        sys.exit(f"genotype not found: {args.genotype}")
    tophits_dir = os.path.join(args.vault, args.tophits_rel)
    if not os.path.isdir(tophits_dir):
        sys.exit(f"top-hits dir not found: {tophits_dir} — run build_genomics_tophits.py first")

    out_dir = os.path.join(args.vault, args.out_rel)
    os.makedirs(out_dir, exist_ok=True)

    print(f"Loading genotypes from {args.genotype}…")
    geno, geno_stats = load_genotypes(args.genotype)
    print(f"  {geno_stats['usable']:,} usable SNPs (skipped {geno_stats['skipped']:,} no-calls/indels)")

    results = []
    for fn in sorted(os.listdir(tophits_dir)):
        if fn.startswith("_") or not fn.endswith(".tsv"):
            continue
        disorder = fn[:-4]
        path = os.path.join(tophits_dir, fn)
        r = analyze_disorder(disorder, path, geno)
        results.append(r)
        print(
            f"  {disorder}: {r['tophits_matched_in_23andMe']:>5}/{r['tophits_examined']:<5} matched, "
            f"{r['n_carrier']:>4} carrier, "
            f"PRS_full={r['centered_prs']:+.3f}, "
            f"PRS_no_MHC={r['centered_prs_non_mhc']:+.3f} ({r['matched_non_mhc']} SNPs), "
            f"MHC={r['centered_prs_mhc_only']:+.3f} ({r['matched_mhc']} SNPs)"
        )

    print("\nScanning transdiagnostic SNPs (≥3 disorders)…")
    multi = transdiagnostic_carriers(tophits_dir, geno)
    multi_in_23 = [r for r in multi if r["in_23andMe"]]
    multi_carrier = [r for r in multi if r["dosage"] and r["dosage"] >= 1]
    print(
        f"  {len(multi):,} multi-disorder SNPs total; {len(multi_in_23):,} typed by 23andMe; "
        f"Dave carries the effect allele in {len(multi_carrier):,}"
    )

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "genotype_file": args.genotype,
        "genotype_stats": geno_stats,
        "by_disorder": results,
        "transdiagnostic": {
            "total_snps": len(multi),
            "in_23andMe": len(multi_in_23),
            "carrier": len(multi_carrier),
            "top_loci": multi[:50],
        },
    }
    with open(os.path.join(out_dir, "personal_prs.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Markdown report.
    lines = [
        "---",
        "type: report",
        'title: "Personal PRS — Dave\'s 23andMe × PGC"',
        f"date: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "tags: [genomics, personal-prs, private]",
        "---",
        "",
        "# Personal PRS — Dave's 23andMe × PGC top-hits",
        "",
        f"_Generated by `scripts/build_genomics_personal_prs.py`. PRIVATE — do not publish raw SNPs._",
        "",
        f"**Genotype file**: `{os.path.basename(args.genotype)}`  ",
        f"**Usable SNPs**: {geno_stats['usable']:,}  (skipped {geno_stats['skipped']:,} no-calls/indels of {geno_stats['total_snps']:,} total)",
        "",
        "## Per-disorder summary",
        "",
        "| Disorder | Typed | Carrier | PRS (full) | PRS (no MHC) | MHC Δ | MHC SNPs |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    sorted_results = sorted(results, key=lambda r: -(r["centered_prs"] or 0))
    for r in sorted_results:
        lines.append(
            "| {d} | {m} | {c} | {cp:+.3f} | {cpn:+.3f} | {mhc:+.3f} | {ms} |".format(
                d=r["disorder"],
                m=r["tophits_matched_in_23andMe"],
                c=r["n_carrier"],
                cp=r["centered_prs"],
                cpn=r["centered_prs_non_mhc"],
                mhc=r["centered_prs_mhc_only"],
                ms=r["matched_mhc"],
            )
        )
    lines.extend([
        "",
        "**How to read**:",
        "- _Typed_: SNPs in that disorder's GWS top-hits that 23andMe types.",
        "- _Carrier_: SNPs where Dave carries ≥1 copy of the effect (risk) allele.",
        "- _PRS (full)_: Σ β·(d−1) over all typed GWS SNPs. Positive = Dave's dosage tilts toward effect alleles vs heterozygous-everywhere baseline.",
        "- _PRS (no MHC)_: same, but excluding chr 6: 25–34 Mb (the extended MHC). MHC is one massive LD block; its many tag SNPs inflate any chip-PRS.",
        "- _MHC Δ_: PRS contribution from the MHC region. Dominates schizophrenia.",
        "- _MHC SNPs_: count of typed GWS SNPs that fell inside the MHC region.",
        "- NOT a clinical score; uncalibrated; not directly comparable across disorders.",
        "",
    ])

    lines.append("## Transdiagnostic SNPs Dave carries")
    lines.append("")
    lines.append(f"_{len(multi):,} SNPs are GWS in ≥3 disorders. {len(multi_in_23):,} are typed by 23andMe. Dave carries the effect allele in {len(multi_carrier):,} of those._")
    lines.append("")
    lines.append("### Top 30 by disorder count, where Dave carries ≥1 effect allele")
    lines.append("")
    lines.append("| rsid | chr:pos | n disorders | disorders | EA | Dave's genotype | dosage |")
    lines.append("|---|---|---|---|---|---|---|")
    carrier_top = [r for r in multi if r.get("dosage") and r["dosage"] >= 1][:30]
    for r in carrier_top:
        lines.append(
            "| `{rsid}` | {chr}:{pos} | {n} | {ds} | {ea} | {gt} | {d} |".format(
                rsid=r["rsid"],
                chr=r.get("chr") or "—",
                pos=r.get("pos") or "—",
                n=r["n_disorders"],
                ds=", ".join(r["disorders"]),
                ea=r["effect_allele"] or "—",
                gt=r["genotype"] or "—",
                d=r["dosage"],
            )
        )

    lines.append("")
    lines.append("## Per-disorder strongest-effect SNPs Dave carries")
    lines.append("")
    for r in sorted_results:
        if not r["strong_carriers_top10"]:
            continue
        lines.append(f"### {r['disorder']}")
        lines.append("")
        lines.append("| rsid | chr:pos | EA | OA | Dave | dosage | beta | p |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for s in r["strong_carriers_top10"]:
            lines.append(
                "| `{rsid}` | {chr}:{pos} | {ea} | {oa} | {gt} | {d} | {b:+.3f} | {p} |".format(
                    rsid=s["rsid"],
                    chr=s.get("chr") or "—",
                    pos=s.get("pos") or "—",
                    ea=s["effect_allele"],
                    oa=s["other_allele"],
                    gt=s["genotype"],
                    d=s["dosage"],
                    b=s["beta"],
                    p=s["p"],
                )
            )
        lines.append("")

    with open(os.path.join(out_dir, "personal_prs.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nWrote {out_dir}/personal_prs.{{json,md}}")


if __name__ == "__main__":
    main()
