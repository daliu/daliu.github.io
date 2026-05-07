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


def analyze_disorder(disorder, tophits_path, geno):
    """Return per-disorder summary dict."""
    matched = 0
    examined = 0
    n_carrier = 0
    n_homo = 0
    sum_beta_dosage = 0.0
    sum_abs_beta_dosage = 0.0
    sum_beta = 0.0  # null reference: PRS if Dave were heterozygous everywhere
    dosage_dist = [0, 0, 0]  # counts of dosage 0 / 1 / 2
    strong_carriers = []  # SNPs where Dave carries the risk allele AND |beta| is large

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
        beta = safe_float(beta_str)
        if beta is None and or_str:
            oratio = safe_float(or_str)
            if oratio and oratio > 0:
                # log(OR) ≈ beta on the same effect-allele convention
                import math
                beta = math.log(oratio)
        if beta is None:
            continue

        g = geno.get(rsid)
        if not g:
            continue
        matched += 1

        # Sanity-check the alleles match. Some sumstats encode strand-flipped
        # alleles; we treat unmatched-allele cases as missing.
        observed = {g["a1"], g["a2"]}
        if not observed.issubset({ea, oa}):
            continue

        d = dosage(g, ea)
        dosage_dist[d] += 1
        sum_beta_dosage += beta * d
        sum_abs_beta_dosage += abs(beta) * d
        sum_beta += beta  # equivalent to dosage=1 reference per SNP
        if d >= 1:
            n_carrier += 1
        if d == 2:
            n_homo += 1

        if d >= 1 and abs(beta) > 0.05:
            strong_carriers.append({
                "rsid": rsid,
                "chr": row.get("chr"),
                "pos": row.get("pos"),
                "effect_allele": ea,
                "other_allele": oa,
                "genotype": g["a1"] + g["a2"],
                "dosage": d,
                "beta": round(beta, 4),
                "p": row.get("p"),
            })

    strong_carriers.sort(key=lambda r: -abs(r["beta"]))
    return {
        "disorder": disorder,
        "tophits_examined": examined,
        "tophits_matched_in_23andMe": matched,
        "n_carrier": n_carrier,
        "n_homo": n_homo,
        "dosage_distribution": {"0": dosage_dist[0], "1": dosage_dist[1], "2": dosage_dist[2]},
        "mean_dosage": round((dosage_dist[1] + 2 * dosage_dist[2]) / matched, 4) if matched else None,
        "sum_beta_dosage": round(sum_beta_dosage, 4),
        "sum_abs_beta_dosage": round(sum_abs_beta_dosage, 4),
        "ref_sum_beta_per_match": round(sum_beta, 4),
        # PRS centered on dosage=1 (heterozygous reference): >0 means Dave's
        # dosage is "more risk-allele than het-everywhere"
        "centered_prs": round(sum_beta_dosage - sum_beta, 4),
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
            f"{r['n_carrier']:>4} carrier, mean dosage={r['mean_dosage']!s:>6}, "
            f"centered PRS={r['centered_prs']:+.3f}"
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
        "| Disorder | Examined | Typed by 23andMe | Carrier | Homo | Mean dosage | Centered PRS |",
        "|---|---|---|---|---|---|---|",
    ]
    # Sort by centered PRS descending (most enriched for risk alleles first)
    sorted_results = sorted(results, key=lambda r: -(r["centered_prs"] or 0))
    for r in sorted_results:
        lines.append(
            "| {d} | {e} | {m} | {c} | {h} | {md} | {cp:+.3f} |".format(
                d=r["disorder"],
                e=r["tophits_examined"],
                m=r["tophits_matched_in_23andMe"],
                c=r["n_carrier"],
                h=r["n_homo"],
                md=r["mean_dosage"] if r["mean_dosage"] is not None else "—",
                cp=r["centered_prs"],
            )
        )
    lines.extend([
        "",
        "**How to read**:",
        "- _Examined_: GWS SNPs in that disorder's top-hits index.",
        "- _Typed by 23andMe_: subset present in Dave's genotype file.",
        "- _Carrier_ / _Homo_: Dave has at least one / both copies of the effect (risk) allele.",
        "- _Mean dosage_: average effect-allele dosage over matched SNPs (0–2). Random expectation depends on allele frequencies; not 1.0 in general.",
        "- _Centered PRS_: Σ β·d − Σ β. Positive = Dave's dosage tilts toward effect alleles relative to a heterozygous-everywhere baseline; negative = away. NOT a clinical score; uncalibrated; subject to LD inflation since hits aren't clumped.",
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
