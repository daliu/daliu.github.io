#!/usr/bin/env python3
"""Catalog Dave's PGC psychiatric-genomics download into a manifest.

Walks ~/Downloads/psychiatric_genomics_consortium_data, classifies every
file by disorder / ancestry / year / study-type / format, samples the
header line of each compressed file to record the column layout, and
emits two artifacts to the Obsidian vault:

  wiki/genomics/manifest.json   machine-readable, one entry per file
  wiki/genomics/manifest.md     human-readable, grouped by disorder

The intent is to pre-process the dataset so future loop iterations can
plan against a stable index instead of repeatedly globbing 24 GB of
opaque .gz / .bz2 files.

Notable conventions encoded in the filenames:
- "daner" prefix is the PGC daner sumstats format
- "no23andMe" / "ex23andMe" / "wo23andMe" → cohort *excludes* 23andMe
  data and is therefore safe to use for cross-referencing Dave's own
  23andMe variants (avoids circularity)
- "noUKB" / "noUKBB" → also excludes UK Biobank
- Ancestry codes: eur, eas, afr, aam (African American), hna (Hispanic
  / Native), lat (Latino), trans/multianc (trans-/multi-ancestry)

Idempotent. Re-run after Dave drops more files in.

Usage:
    python scripts/build_genomics_manifest.py
    python scripts/build_genomics_manifest.py --no-headers     # skip the per-file header sampling (faster)
    python scripts/build_genomics_manifest.py --pgc-dir PATH
"""

from __future__ import annotations

import argparse
import bz2
import gzip
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

DEFAULT_PGC_DIR = os.path.expanduser("~/Downloads/psychiatric_genomics_consortium_data")
DEFAULT_VAULT = os.path.expanduser("~/Documents/Remote Vault")
DEFAULT_OUT_REL = "wiki/genomics"

# Disorder fingerprints in priority order. First hit wins.
# Note on boundaries: \b treats `_` as a word character, so `\bOCD\b`
# would NOT match `_OCD_`. We use letter-only lookarounds instead.
def _T(token: str) -> str:
    """token surrounded by 'not-a-letter' on both sides."""
    return rf"(?<![A-Za-z]){token}(?![A-Za-z])"

def _TS(token: str) -> str:
    """token preceded by 'not-a-letter' (or start-of-string), trailing free.
    Use for short acronyms like OCD that legitimately get glued to other
    text (OCDmeta, ADHDmale, etc.)."""
    return rf"(?<![A-Za-z]){token}"

DISORDER_PATTERNS = [
    ("F1_compulsive_factor", re.compile(r"^F1_", re.IGNORECASE)),
    ("F2_psychosis_factor",  re.compile(r"^F2_", re.IGNORECASE)),
    ("F3_neurodev_factor",   re.compile(r"^F3_", re.IGNORECASE)),
    ("F4_internalizing_factor", re.compile(r"^F4_", re.IGNORECASE)),
    ("F5_substance_factor",  re.compile(r"^F5_", re.IGNORECASE)),
    ("p_factor",             re.compile(r"PFactor", re.IGNORECASE)),
    ("antidepressant_response", re.compile(r"AntiDep", re.IGNORECASE)),
    ("hoarding",             re.compile(r"hoarding", re.IGNORECASE)),
    ("cannabis_intoxication", re.compile(_T("cia") + r"|cannabis", re.IGNORECASE)),
    ("postpartum_depression", re.compile(_T("ppd"), re.IGNORECASE)),
    ("eating_disorder",      re.compile(r"pgc\.ed\.|pgcAN|" + _T("an2"), re.IGNORECASE)),
    ("tourette",             re.compile(r"^TS_|tourette", re.IGNORECASE)),
    ("anxiety",              re.compile(r"^ANX_|anxiety|gadsymp|pgc-anx|jamapsy", re.IGNORECASE)),
    # NB: jamapsy_Giannakopoulou_2021 is a treatment-resistant depression
    # paper that's grouped with anxiety/depression literature; pattern lands
    # it here, will revisit when we open the file.
    ("panic",                re.compile(_T("panic"), re.IGNORECASE)),
    ("ASD",                  re.compile(_T("ASD") + r"|autism|ipsych-pgc_asd", re.IGNORECASE)),
    ("ADHD",                 re.compile(_T("ADHD"), re.IGNORECASE)),
    ("OCD",                  re.compile(_TS("OCD") + r"|^ocs|obsessive", re.IGNORECASE)),
    ("PTSD",                 re.compile(_T("PTSD") + r"|^pts_|^aam_ptsd|^eur_ptsd|^hna_ptsd|^trans_ptsd", re.IGNORECASE)),
    # SCZvsBD / SCZvscont / BD-vs-SCZ comparisons
    ("schizophrenia_vs_bipolar", re.compile(r"SCZvsBD|BDSCZvsCONT|MDD_BIP", re.IGNORECASE)),
    ("schizophrenia",        re.compile(_T("SCZ") + r"|schizo|CLOZUK|sczvs|scz\.", re.IGNORECASE)),
    ("bipolar",              re.compile(r"^bip|^BD|bipolar|^pgc-bip|pgc\.bip|^daner_bip|daner_PGC_BIP", re.IGNORECASE)),
    ("borderline_personality", re.compile(r"^bpd|_bpd|" + _T("bor") + r"|borderline|prsCS_bpd|prsCS_bor", re.IGNORECASE)),
    ("MDD",                  re.compile(
        _T("MDD") + r"|depression|^mdd_|^pgc-mdd|pgc\.mdd|^daner_(?:pgc_)?mdd|^MDD_|^MHQ_",
        re.IGNORECASE,
    )),
    ("addiction",            re.compile(r"addiction|substance.*use", re.IGNORECASE)),
    ("cross_disorder",       re.compile(r"cdg2|cross\.full|pgc\.cross", re.IGNORECASE)),
    ("_gwas_catalog",        re.compile(r"gwas_catalog", re.IGNORECASE)),
    ("_readme",              re.compile(r"^readme|_readme", re.IGNORECASE)),
]

# Ancestry tokens, matched as whole-token (delimited by _ - . / start / end).
ANCESTRY_PATTERNS = [
    ("AAM",   re.compile(r"(?<![A-Za-z])aam(?![A-Za-z])", re.IGNORECASE)),
    ("HNA",   re.compile(r"(?<![A-Za-z])hna(?![A-Za-z])", re.IGNORECASE)),
    ("EUR",   re.compile(r"(?<![A-Za-z])(?:eur|euro)(?![A-Za-z])", re.IGNORECASE)),
    ("EAS",   re.compile(r"(?<![A-Za-z])eas(?![A-Za-z])", re.IGNORECASE)),
    ("AFR",   re.compile(r"(?<![A-Za-z])afr(?![A-Za-z])", re.IGNORECASE)),
    ("LAT",   re.compile(r"(?<![A-Za-z])lat(?![A-Za-z])", re.IGNORECASE)),
    ("TAM",   re.compile(r"(?<![A-Za-z])tam(?![A-Za-z])", re.IGNORECASE)),
    ("TRANS", re.compile(r"(?<![A-Za-z])trans(?![A-Za-z])", re.IGNORECASE)),
    ("MULTI", re.compile(r"multianc|multi[_-]anc|all_ancestry", re.IGNORECASE)),
]

# Format hints from the suffix.
FORMAT_SUFFIXES = [
    (".vcf.tsv.gz", "vcf-as-tsv.gz"),
    (".vcf.gz",    "vcf.gz"),
    (".tsv.gz",    "tsv.gz"),
    (".txt.gz",    "txt.gz"),
    (".tsv",       "tsv"),
    (".txt",       "txt"),
    (".bz2",       "bz2"),
    (".gz",        "gz"),
    (".xlsx",      "xlsx"),
    (".xls",       "xls"),
    (".zip",       "zip"),
    (".pdf",       "pdf"),
]


def classify_file(filename: str) -> dict:
    """Return a metadata dict from the filename alone."""
    f = filename
    f_low = f.lower()

    # Disorder
    disorder = None
    for label, pat in DISORDER_PATTERNS:
        if pat.search(f):
            disorder = label
            break

    # Ancestry
    ancestry = None
    for label, pat in ANCESTRY_PATTERNS:
        if pat.search(f):
            ancestry = label
            break

    # Year
    year = None
    m = re.search(r"(?<!\d)(20\d{2})(?!\d)", f)
    if m:
        year = int(m.group(1))

    # Study type
    study = "summary_stats"
    if "readme" in f_low or f_low.endswith(".pdf"):
        study = "documentation"
    elif f_low.endswith(".vcf.gz") or f_low.endswith(".vcf.tsv.gz"):
        # PCs files are population-structure principal components in VCF;
        # sumstats VCFs from GWAS Catalog are also possible.
        if "_pcs_" in f_low or f_low.endswith("_pcs_v" + f_low.split("_pcs_v")[-1]):
            study = "pcs_or_vcf"
        else:
            study = "vcf"
    elif "daner" in f_low:
        study = "daner_sumstats"
    elif "clump" in f_low:
        study = "clumped"
    elif "top_10k" in f_low or "10k_clumped" in f_low:
        study = "top_hits"
    elif "prs_prscs" in f_low or "_prscs_" in f_low:
        study = "prs_weights"
    elif "metacarpa" in f_low:
        study = "metacarpa_meta"
    elif "meta" in f_low or ".tbl" in f_low or "sumstats" in f_low:
        study = "meta_analysis"
    elif "symptoms" in f_low:
        study = "per_symptom"
    elif "gwas_catalog" in f_low:
        study = "catalog_index"

    # Format
    fmt = "unknown"
    for sfx, label in FORMAT_SUFFIXES:
        if f_low.endswith(sfx):
            fmt = label
            break

    excludes_23andme = bool(
        re.search(r"no23andme|ex23andme|wo23andme|exclude.*23andme", f_low)
    )
    excludes_ukbb = bool(re.search(r"noukbb?|wo_ukb|wouhkb|exclude.*ukb", f_low))

    return {
        "filename": f,
        "disorder": disorder or "_unclassified",
        "ancestry": ancestry,
        "year": year,
        "study_type": study,
        "format": fmt,
        "excludes_23andme": excludes_23andme,
        "excludes_ukbb": excludes_ukbb,
    }


def _first_data_header(line_iter):
    """Return the first non-blank line that isn't a VCF-style `##` metadata
    comment. The column header in VCF starts with a single `#` — keep that.
    """
    for raw in line_iter:
        if not raw.strip():
            continue
        if raw.startswith("##"):
            continue
        return raw
    return None


def sample_header(path: str) -> dict:
    """Open the file just enough to read the first column-header line.

    Returns {'header': str | None, 'fields': list[str], 'note': str | None}.
    """
    out = {"header": None, "fields": [], "note": None}
    name = os.path.basename(path).lower()
    try:
        if name.endswith(".gz"):
            with gzip.open(path, "rt", encoding="utf-8", errors="replace") as fh:
                line = _first_data_header(fh)
        elif name.endswith(".bz2"):
            with bz2.open(path, "rt", encoding="utf-8", errors="replace") as fh:
                line = _first_data_header(fh)
        elif name.endswith((".tsv", ".txt")):
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                line = _first_data_header(fh)
        elif name.endswith(".zip"):
            import zipfile
            with zipfile.ZipFile(path) as z:
                names = [n for n in z.namelist() if not n.endswith("/")]
                if not names:
                    return out
                out["note"] = f"contains {len(names)} files; first: {names[0]}"
                with z.open(names[0]) as inner:
                    # Read up to ~64 KB to get past any VCF preamble.
                    raw = inner.read(65536)
                if raw:
                    text = raw.decode("utf-8", errors="replace")
                    line = _first_data_header(text.splitlines(keepends=True))
                else:
                    line = None
        else:
            return out  # xlsx / xls / pdf — skip
        if line:
            stripped = line.rstrip("\n").rstrip("\r").lstrip("#").strip()
            out["header"] = stripped[:400]
            fields = stripped.split("\t") if "\t" in stripped else stripped.split()
            out["fields"] = fields[:50]
    except Exception as e:
        out["note"] = f"read error: {e.__class__.__name__}: {str(e)[:120]}"
    return out


def build_manifest(pgc_dir: str, sample_headers: bool = True) -> dict:
    files = sorted(os.listdir(pgc_dir))
    entries = []
    for fn in files:
        path = os.path.join(pgc_dir, fn)
        if not os.path.isfile(path):
            continue
        meta = classify_file(fn)
        meta["size_bytes"] = os.path.getsize(path)
        meta["size_human"] = _human_bytes(meta["size_bytes"])
        if sample_headers:
            meta.update(sample_header(path))
            # If we couldn't classify from the outer filename and this is a
            # zip whose interior gives a hint, try classifying from there.
            if meta["disorder"] == "_unclassified" and meta.get("note", "").startswith("contains "):
                m = re.search(r"first: (.+)$", meta["note"])
                if m:
                    inner_meta = classify_file(m.group(1))
                    if inner_meta["disorder"] != "_unclassified":
                        meta["disorder"] = inner_meta["disorder"]
                        if inner_meta["ancestry"]:
                            meta["ancestry"] = inner_meta["ancestry"]
                        if inner_meta["year"]:
                            meta["year"] = inner_meta["year"]
        entries.append(meta)

    by_disorder = defaultdict(list)
    for e in entries:
        by_disorder[e["disorder"]].append(e["filename"])

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_dir": pgc_dir,
        "file_count": len(entries),
        "total_bytes": sum(e["size_bytes"] for e in entries),
        "by_disorder": {
            k: sorted(v) for k, v in sorted(by_disorder.items(), key=lambda kv: kv[0])
        },
        "entries": entries,
    }
    return manifest


def _human_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} GB"


def render_markdown(manifest: dict) -> str:
    total = manifest["file_count"]
    size = _human_bytes(manifest["total_bytes"])
    lines = [
        "---",
        "type: meta",
        'title: "PGC Genomics Dataset Manifest"',
        f"updated: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "tags:",
        "  - genomics",
        "  - dataset-manifest",
        "---",
        "",
        "# PGC Genomics Dataset Manifest",
        "",
        f"_Auto-generated by `scripts/build_genomics_manifest.py`._  ",
        f"**Source**: `{manifest['source_dir']}`  ",
        f"**Files**: {total}  ",
        f"**Total size**: {size}",
        "",
        "## How to read this",
        "Files are grouped by disorder. Each row notes ancestry (when encoded in the filename), year, study type, format, and whether the cohort *excluded* 23andMe / UK Biobank — relevant because cross-referencing Dave's 23andMe variants against a GWAS that already saw 23andMe data is circular. Prefer the `excludes_23andme=True` rows for that.",
        "",
        "Common study-type codes:",
        "- `daner_sumstats` — PGC daner-format full GWAS sumstats (CHR/POS/SNP/A1/A2/FRQ/INFO/OR/SE/P columns)",
        "- `meta_analysis` — meta-analysed sumstats (smaller column set typical)",
        "- `metacarpa_meta` — METACARPA pipeline output",
        "- `clumped` / `top_hits` — pre-filtered to most-significant SNPs (smaller, easy to start with)",
        "- `vcf` / `vcf-as-tsv.gz` — VCF format (variant-centric); some files are GWAS Catalog VCF tables",
        "- `pcs_or_vcf` — population-structure principal components",
        "- `prs_weights` — PRS-CS weights (ready-to-apply per-SNP weights)",
        "",
    ]
    by_disorder = defaultdict(list)
    for e in manifest["entries"]:
        by_disorder[e["disorder"]].append(e)

    # Stable, useful disorder ordering: factors first, then alphabetical.
    factor_order = [
        "p_factor", "F1_compulsive_factor", "F2_psychosis_factor",
        "F3_neurodev_factor", "F4_internalizing_factor", "F5_substance_factor",
    ]
    leading = [d for d in factor_order if d in by_disorder]
    rest = sorted(d for d in by_disorder if d not in leading and not d.startswith("_"))
    trailing = sorted(d for d in by_disorder if d.startswith("_"))
    ordered = leading + rest + trailing

    for disorder in ordered:
        items = sorted(by_disorder[disorder], key=lambda e: (-(e["year"] or 0), e["filename"]))
        n = len(items)
        lines.append(f"## {disorder}  ({n} file{'s' if n != 1 else ''})")
        lines.append("")
        lines.append("| File | Year | Ancestry | Study | excl. 23andMe | excl. UKBB | Size |")
        lines.append("|---|---|---|---|---|---|---|")
        for e in items:
            lines.append(
                "| `{fn}` | {y} | {anc} | {st} | {x23} | {xukb} | {sz} |".format(
                    fn=e["filename"],
                    y=e["year"] or "—",
                    anc=e["ancestry"] or "—",
                    st=e["study_type"],
                    x23="yes" if e["excludes_23andme"] else "—",
                    xukb="yes" if e["excludes_ukbb"] else "—",
                    sz=e["size_human"],
                )
            )
        # Optional: header preview of first daner/sumstats per disorder.
        for e in items:
            if e.get("fields"):
                lines.append("")
                lines.append(f"**Header sample** (`{e['filename']}`): `{' / '.join(e['fields'][:14])}`")
                if e.get("note"):
                    lines.append(f"_Note_: {e['note']}")
                break
        lines.append("")

    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pgc-dir", default=DEFAULT_PGC_DIR)
    ap.add_argument("--vault", default=DEFAULT_VAULT)
    ap.add_argument("--out-rel", default=DEFAULT_OUT_REL)
    ap.add_argument("--no-headers", action="store_true",
                    help="skip per-file header sampling (faster)")
    args = ap.parse_args()

    if not os.path.isdir(args.pgc_dir):
        sys.exit(f"PGC dir not found: {args.pgc_dir}")

    out_dir = os.path.join(args.vault, args.out_rel)
    os.makedirs(out_dir, exist_ok=True)

    manifest = build_manifest(args.pgc_dir, sample_headers=not args.no_headers)

    json_path = os.path.join(out_dir, "manifest.json")
    md_path = os.path.join(out_dir, "manifest.md")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(render_markdown(manifest))

    by_disorder = defaultdict(int)
    for e in manifest["entries"]:
        by_disorder[e["disorder"]] += 1
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    print(f"{manifest['file_count']} files, {_human_bytes(manifest['total_bytes'])}")
    print("By disorder:")
    for d, n in sorted(by_disorder.items(), key=lambda kv: -kv[1]):
        print(f"  {n:>4}  {d}")


if __name__ == "__main__":
    main()
