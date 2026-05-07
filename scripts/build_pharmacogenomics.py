#!/usr/bin/env python3
"""Per-variant pharmacogenomic lookup against a 23andMe v5 raw genotype file.

Reads the curated VARIANTS table below and prints, for each rsid present
in the genotype file, the genotype + functional read + East-Asian
allele-frequency context. Output is plain text suitable for pasting
into a report or piping to a Markdown formatter.

This is the analysis backing the /genomics/ public page. No PRS, no
aggregate scoring, no cross-disorder cross-reference — just per-variant
lookup with literature-grounded interpretation.

Usage:
    python scripts/build_pharmacogenomics.py
    python scripts/build_pharmacogenomics.py --genotype PATH

Input format: 23andMe raw download, tab-separated `rsid<TAB>chrom<TAB>pos<TAB>genotype`,
with `#` comment lines, where genotype is two ACGT bases (e.g. "AG", "CC").
Indels (II/DD/DI), no-calls (--/00), and other non-biallelic calls are skipped.
"""

from __future__ import annotations

import argparse
import os
import sys

DEFAULT_GENOTYPE = os.path.expanduser(
    "~/Downloads/genome_Dave_Liu_v5_Full_20220828070944.txt"
)

# Each entry: rsid, gene/variant label, allele-frequency context (population),
# and a genotype-to-interpretation dict. Genotype keys are matched
# against the 23andMe report in alphabetic order (e.g. "AG" not "GA"),
# so list both orderings as a key fallback.
VARIANTS = [
    # === CYP2C19 (PPIs / clopidogrel / SSRIs) ===
    ("rs4244285",  "CYP2C19 *2",
     "Loss-of-function. EAS *2 freq ~30%, EUR ~15%. Combined with *3 determines metabolizer status",
     {"GG": "no *2 (extensive metabolizer at this position)",
      "AG": "one *2 allele (intermediate metabolizer if no other LoF)",
      "AA": "two *2 alleles (poor metabolizer at this position)"}),
    ("rs4986893",  "CYP2C19 *3",
     "Loss-of-function. EAS *3 freq ~5%, essentially absent in EUR",
     {"GG": "no *3",
      "AG": "one *3 allele",
      "AA": "two *3 alleles"}),

    # === Warfarin pharmacogenes ===
    ("rs9923231",  "VKORC1 −1639",
     "Affects warfarin dose. EAS A allele freq ~90%, EUR ~40%",
     {"CC": "high warfarin dose (the EUR-typical pattern)",
      "CT": "intermediate warfarin dose",
      "TT": "low warfarin dose (the EAS-typical pattern)"}),
    ("rs1799853",  "CYP2C9 *2",
     "Loss-of-function. EAS *2 <1%, EUR ~12%",
     {"CC": "no *2 (typical EAS)",
      "CT": "*1/*2",
      "TT": "*2/*2"}),
    ("rs1057910",  "CYP2C9 *3",
     "Loss-of-function. EAS *3 ~5%, EUR ~7%",
     {"AA": "no *3",
      "AC": "*1/*3 (slower clearance)",
      "CC": "*3/*3 (very rare; markedly slow metabolism)"}),

    # === Statin myopathy risk ===
    ("rs4149056",  "SLCO1B1 *5",
     "T->C reduces hepatic statin uptake. EAS *5 ~13%, EUR ~17%",
     {"TT": "*1A/*1A (typical statin transport, no elevated myopathy risk)",
      "CT": "*1A/*5 (intermediate; modest myopathy risk for high-dose simvastatin)",
      "CC": "*5/*5 (slow transport; ~7x simvastatin myopathy risk)"}),

    # === Other drug-class pharmacogenes ===
    ("rs3918290",  "DPYD *2A",
     "Splice variant. EAS rare (<1%), EUR ~1%. Causes severe 5-FU toxicity",
     {"CC": "*1/*1 (typical)",
      "CT": "*1/*2A (heterozygous; ~50% DPD activity)",
      "TT": "*2A/*2A (very rare)"}),
    ("rs3745274",  "CYP2B6 *6",
     "Reduced function. EAS *6 ~25%, EUR ~25%, AFR ~50%. Affects efavirenz, methadone, bupropion",
     {"GG": "*1/*1",
      "GT": "*1/*6 (slower clearance)",
      "TT": "*6/*6 (slow metabolizer)"}),
    ("rs4148323",  "UGT1A1 *6 (Gly71Arg)",
     "EAS-specific reduced-function. EAS *6 ~15-20%, EUR <1%",
     {"GG": "no *6 allele",
      "AG": "*1/*6 (mild reduction)",
      "AA": "*6/*6 (markedly reduced UGT1A1)"}),
    ("rs776746",   "CYP3A5 *3",
     "Splice variant; nonexpresser. EAS *3 ~75%, EUR ~95%, AFR ~30%. Affects tacrolimus dosing. STRAND-FLIP RISK on 23andMe",
     {"AA": "*1/*1 (expresser; needs higher tacrolimus dose)",
      "AG": "*1/*3 (intermediate)",
      "GG": "*3/*3 (nonexpresser; standard tacrolimus dose works fine)",
      # 23andMe sometimes reports rs776746 on the reverse strand:
      "CC": "likely *3/*3 (reverse-strand encoding; verify on a clinical panel)",
      "CT": "likely *1/*3 (reverse-strand)",
      "TT": "likely *1/*1 (reverse-strand)"}),
    ("rs12979860", "IFNL3 (IL28B)",
     "EAS C freq ~90%, EUR ~70%. CC = better interferon-α + ribavirin response in HCV",
     {"CC": "C/C (favorable HCV treatment response)",
      "CT": "C/T (intermediate)",
      "TT": "T/T (less favorable response)"}),

    # === Alcohol pharmacology (EAS-specific) ===
    ("rs671",      "ALDH2 *504Lys",
     "EAS *504Lys (G allele) freq ~30%; ~40% of EAS are AG (mild flush), ~10% AA (severe flush)",
     {"GG": "Glu/Glu (*1/*1; standard ALDH2)",
      "AG": "Glu/Lys (*1/*2; mild flush, slower acetaldehyde clearance)",
      "AA": "Lys/Lys (*2/*2; severe flush)"}),

    # === Caffeine pharmacology ===
    ("rs762551",   "CYP1A2 *1F",
     "Caffeine metabolism speed. *1A = fast (half-life ~3-4h); *1F = slow (half-life 6+h)",
     {"AA": "*1A/*1A (fast caffeine metabolizer)",
      "AC": "*1A/*1F (heterozygous)",
      "CC": "*1F/*1F (slow metabolizer)"}),
    ("rs5751876",  "ADORA2A",
     "Caffeine-induced anxiety sensitivity",
     {"CC": "reduced caffeine anxiety sensitivity",
      "CT": "heterozygous",
      "TT": "increased anxiety / poor sleep response to caffeine"}),

    # === APOE (cross-ancestry interpretable) ===
    ("rs429358",   "APOE — rs429358 (combined with rs7412 for ε haplotype call)",
     "TT + rs7412 CC = ε3/ε3 · CT + rs7412 CC = one ε4 copy · CC + rs7412 CC = ε4/ε4",
     {"TT": "no ε4 component",
      "CT": "one ε4 copy",
      "CC": "two ε4 copies"}),
    ("rs7412",     "APOE — rs7412 (combined with rs429358 for ε haplotype call)",
     "CC + rs429358 TT = ε3/ε3 · CT + rs429358 TT = one ε2 copy · TT + rs429358 TT = ε2/ε2",
     {"CC": "no ε2 component",
      "CT": "one ε2 copy",
      "TT": "two ε2 copies"}),

    # === Neurotransmitter / receptor (descriptive) ===
    ("rs4680",     "COMT Val158Met",
     "Catecholamine clearance. ~50% global Val/Met heterozygote",
     {"GG": "Val/Val (faster clearance)",
      "AG": "Val/Met (intermediate, population mean)",
      "AA": "Met/Met (slower clearance)"}),
    ("rs1800497",  "DRD2/ANKK1 Taq1A",
     "A1 allele tags lower D2 binding. EAS A1 ~40-50%, EUR ~25-30%",
     {"GG": "A2/A2 (typical D2 density)",
      "AG": "A1/A2 (~15-20% reduced striatal D2 binding)",
      "AA": "A1/A1 (~30-40% reduced)"}),
    ("rs1799971",  "OPRM1 Asn40Asp",
     "EAS Asp40 freq ~35-45%, EUR ~10-15%; ~15-20% of EAS are Asp/Asp",
     {"AA": "Asn/Asn (typical)",
      "AG": "Asn/Asp (heterozygous; better naltrexone response)",
      "GG": "Asp/Asp (homozygous; reduced opioid signaling)"}),
]


def load_genotypes(path):
    """Return dict[rsid -> (a1, a2)] from a 23andMe TSV download."""
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


def lookup(geno):
    """Return list of (rsid, gene, gt_str, interpretation, context) tuples
    for each variant in VARIANTS that the genotype file covers."""
    out = []
    for rsid, gene, ctx, mapping in VARIANTS:
        if rsid not in geno:
            out.append((rsid, gene, "—", "(not typed by this chip)", ctx))
            continue
        a1, a2 = geno[rsid]
        gt_alpha = "".join(sorted([a1, a2]))
        keys = (a1 + a2, a2 + a1, gt_alpha)
        interp = None
        for k in mapping:
            if k in keys:
                interp = mapping[k]
                break
        out.append((rsid, gene, a1 + a2, interp or f"(genotype {a1+a2} not in mapping)", ctx))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--genotype", default=DEFAULT_GENOTYPE,
                    help="path to 23andMe raw download (default: %(default)s)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    if not os.path.isfile(args.genotype):
        sys.exit(f"genotype file not found: {args.genotype}")

    geno = load_genotypes(args.genotype)
    print(f"# {len(geno):,} usable biallelic SNPs loaded from {os.path.basename(args.genotype)}\n")

    results = lookup(geno)
    print(f"{'rsID':<14s} {'gene/variant':<26s} {'gt':<5s} {'interpretation'}")
    print("-" * 110)
    for rsid, gene, gt, interp, ctx in results:
        print(f"{rsid:<14s} {gene:<26s} {gt:<5s} {interp}")
        if args.verbose:
            print(f"{'':<14s} {'':<26s} {'':<5s}   ({ctx})")


if __name__ == "__main__":
    main()
