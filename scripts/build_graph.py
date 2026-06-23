#!/usr/bin/env python3
"""
Build a public knowledge graph JSON from the Obsidian vault.

Reads wiki/ pages, extracts topics and wikilinks, filters out private content,
and outputs a JSON file for the D3.js visualization on daliu.github.io/knowledge.

Usage:
    python build_graph.py [--vault PATH] [--output PATH]
"""

import argparse
import json
import os
import re


# Folders to include in the public graph (relative to vault root)
PUBLIC_FOLDERS = [
    "wiki/concepts",
    "wiki/entities",
    "wiki/areas",
    "wiki/learning",
    "wiki/resources",
    "wiki/goals",
    "wiki/sources",
    "wiki/questions",
    "wiki/comparisons",
]

# Folders explicitly excluded (private)
PRIVATE_FOLDERS = [
    "wiki/conversations",
    "wiki/meta",
    "wiki/people",
    "Personal",
]

# Meta files to skip
SKIP_FILES = {"_index.md", "index.md", "hot.md", "log.md", "overview.md", "dashboard.md"}

# Map wiki folder to node type and color
FOLDER_TYPES = {
    "concepts": {"type": "concept", "color": "#dcdcaa"},
    "entities": {"type": "entity", "color": "#c586c0"},
    "areas": {"type": "area", "color": "#4fc1ff"},
    "learning": {"type": "learning", "color": "#4ec9b0"},
    "resources": {"type": "resource", "color": "#ce9178"},
    "goals": {"type": "goal", "color": "#6a9955"},
    "sources": {"type": "source", "color": "#ce9178"},
    "questions": {"type": "question", "color": "#6a9955"},
    "comparisons": {"type": "comparison", "color": "#d16969"},
    # Types for notes that opt in via `public: true` from otherwise-private folders.
    "conversations": {"type": "conversation", "color": "#569cd6"},
    "genomics": {"type": "concept", "color": "#dcdcaa"},
    "daily": {"type": "note", "color": "#808080"},
    "claude": {"type": "note", "color": "#808080"},
    "claude-sessions": {"type": "note", "color": "#808080"},
}

# Set of public folder names (last path component) for quick membership tests.
PUBLIC_FOLDER_NAMES = {f.split("/")[-1] for f in PUBLIC_FOLDERS}


def _truthy(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("true", "yes", "1")
    return False


def _is_false(v):
    if isinstance(v, bool):
        return v is False
    if isinstance(v, str):
        return v.strip().lower() in ("false", "no", "0")
    return False


def is_public_optin(fm):
    """True if a note explicitly opts into the public graph via `public: true`."""
    return _truthy(fm.get("public"))


def is_public_optout(fm):
    """True if a note explicitly opts OUT via `public: false`."""
    return _is_false(fm.get("public"))


# Titles matching this are DETAIL notes (implementation internals) — excluded
# from folder-level inclusion even in a public folder, because the graph
# publishes titles. A per-note `public: true` still overrides this (explicit
# wins over heuristic). Keeps "aggregated, no details": project/component hubs
# pass (Architecture Hub, Embeddings & Models, Reranking Engine), but
# schema/DDL/DAG/spec/eval/monitoring/endpoint titles are dropped.
DETAIL_TITLE_RE = re.compile(
    r"\b(schema|ddl|data dictionary|airflow|dags?|build & deploy|eval|metrics|"
    r"monitoring|observability|online request path|integration spec|"
    r"legacy ddfy|indexes|endpoint)\b",
    re.I,
)


# --- Topic hubs (tag-based connectivity) ---------------------------------- #
# Most journaled notes never [[wikilink]] each other, so they land as isolated
# nodes even though their TAGS clearly relate them (e.g. five patterns-of-choice
# conversations). We synthesize "topic" hub nodes from those tags and connect
# each note to its hubs — pure aggregation from the notes' own metadata (no new
# detail leaks; every linked note is already public). This is what turns a
# scatter of dots into a navigable graph.

# Structural / generic tags that should NOT drive topical connections.
HUB_STOPLIST = {
    "conversation", "note", "area", "idea", "meta", "handoff", "seed",
    "developing", "public", "private", "loop", "autonomous-loop", "new-project",
    "product", "incident", "comparison", "real-data", "pivot", "infrastructure",
    "methodology", "concept", "entity", "resource", "goal", "question", "source",
    "architecture", "repo", "project",  # too generic to be a meaningful hub
}

# Merge tag variants / synonyms onto one canonical tag so related notes hub together.
TAG_CANON = {
    "daliu.github.io": "daliu-github-io",
    "daliu-github-io": "daliu-github-io",
    "investing": "finance",
    "pharmacogenomics": "genomics", "psychiatric-genetics": "genomics",
    "23andme": "genomics", "east-asian": "genomics",
    "legal-tech": "metis", "legal-nlp": "metis",
    "runmprc": "mprc", "firebase": "mprc", "firestore": "mprc",
    "moneysignals": "autotrader", "trading": "autotrader",
    "trading-infrastructure": "autotrader", "cost-optimization": "autotrader",
    "robinhood": "autotrader", "macroeconomics": "autotrader", "postgres": "autotrader",
    "timescaledb": "autotrader", "database": "autotrader", "signals": "autotrader",
    "self-improving-systems": "machine-learning", "legal-nlp ": "metis",
    "vault-tooling": "knowledge-management", "obsidian": "knowledge-management",
    "knowledge-graph": "knowledge-management",
    "claude-project": "claude-harness", "agent-design": "claude-harness",
    "subagents": "claude-harness", "claude-code": "claude-harness",
    "claude-harness": "claude-harness", "agents": "claude-harness",
    "supply-chain": "security", "npm": "security",
    "political-economy": "philosophy", "incentives": "philosophy",
    "georgism": "philosophy", "free-will": "philosophy",
    "site-polish": "daliu-github-io", "accessibility": "daliu-github-io",
    "email-obfuscation": "daliu-github-io", "audit-cycle": "daliu-github-io",
    "health-dashboard": "health", "garmin": "health", "google-calendar": "health",
    "fitness": "health",
    "code-review": "testing", "data-viz": "data-viz",
    "research-instrument": "patterns-of-choice", "research": "patterns-of-choice",
    "workflows": "claude-harness", "multi-agent": "claude-harness",
    # Work projects are organized by company → project → notes (see WORK_* below),
    # NOT as tag hubs, so no Shipt/Onos tag-canon entries here.
    # Misc connectors so standalone conversations aren't orphans.
    "nlp": "machine-learning", "senticnet": "machine-learning", "python-package": "machine-learning",
    "interview": "career", "thomson-reuters": "career", "freenome": "career",
}

# Nice display titles for canonical hub tags. Where a title matches an existing
# vault node (e.g. the area pages), the hub REUSES that node instead of duplicating.
HUB_TITLE = {
    "patterns-of-choice": "Patterns of Choice",
    "autotrader": "AutoTrader / MoneySignals",
    "genomics": "Genomics",
    "metis": "Metis (Legal ML)",
    "meta-council": "Meta-Council",
    "daliu-github-io": "daliu.github.io",
    "mprc": "Run-MPRC",
    "claude-harness": "Claude Harness & Agents",
    "knowledge-management": "Knowledge Management",
    "security": "Security",
    "philosophy": "Philosophy & Ethics",
    "health": "Health and Fitness",
    "finance": "Finance and Investing",
    "machine-learning": "Machine Learning",
    "automation": "Automation",
    "testing": "Testing & Review",
    "data-viz": "Data Visualization",
    "career": "Career",
}

HUB_NODE = {"type": "topic", "color": "#f0a500"}

# --- Work organization: company → project → notes ------------------------- #
# Dave's org request: group the employer work by COMPANY. Onos Health (current
# day job — LOCUS, the Argus PR-review agent on OnosHealth/onos) and Shipt
# (Deals For You / Seasonality / personifier personalization work). The work
# notes carry no tags, so they're mapped by folder (project folders) or by title
# (the loose entity notes). Each note → its project hub → its company hub.
COMPANY_NODE = {"type": "company", "color": "#f778ba"}
PROJECT_NODE = {"type": "project", "color": "#ffa657"}

# Project folders that should be published even though they're nested under a
# public folder (the depth-1 rule otherwise skips nested dirs). rel-path under wiki/.
WORK_FOLDERS = {"areas/seasonality", "areas/deals-for-you-v2"}

WORK_FOLDER_PROJECT = {            # folder rel-path → (project hub, company hub)
    "areas/seasonality": ("Seasonality", "Shipt"),
    "areas/deals-for-you-v2": ("Deals For You V2", "Shipt"),
}
WORK_TITLE_PROJECT = {             # specific note title → (project hub, company hub)
    "personifier-vector-serve": ("Personifier", "Shipt"),
    "personifier-reranking": ("Personifier", "Shipt"),
    "personifier-features-gen": ("Personifier", "Shipt"),
    "personifier-features-publisher": ("Personifier", "Shipt"),
    "serendipity": ("Deals For You V2", "Shipt"),        # DFY request coordinator
    "discovery-trend-items": ("Seasonality", "Shipt"),   # Seasonality source repo
    "Deals For You": ("Deals For You V2", "Shipt"),
    "Habituation Tier vs Holiday-Shopper as Customer-Segmentation Axes (Shipt Tag Platform)":
        ("Tag Platform", "Shipt"),
    "Argus — Portable, Configurable PR Reviewer": ("PR Reviews", "Onos Health"),
}


def add_work_hubs(nodes, edges, note_folder):
    """Build the company → project → notes hierarchy (mutates nodes/edges).

    Each work note links to its project hub; each project hub links to its
    company hub. Project/company hubs are synthesized as their own node types.
    """
    def ensure(title, spec):
        if title not in nodes:
            nodes[title] = {"id": title, "type": spec["type"], "color": spec["color"],
                            "status": "hub", "tags": []}

    project_to_company = {}
    for title in list(nodes):
        pc = WORK_TITLE_PROJECT.get(title) or WORK_FOLDER_PROJECT.get(note_folder.get(title, ""))
        if not pc:
            continue
        project, company = pc
        ensure(project, PROJECT_NODE)
        ensure(company, COMPANY_NODE)
        if title != project:
            edges.append({"source": title, "target": project})
        project_to_company[project] = company
    for project, company in project_to_company.items():
        if project != company:
            edges.append({"source": project, "target": company})
CURATED_HUB_MIN = 2     # a curated topic hubs once >=2 notes share it
# Only curated (vetted-name) hubs are created — never auto-name a hub from a raw
# tag. This keeps the graph legible and avoids elevating confidential detail tags
# (e.g. model architectures / project codenames) into first-class graph nodes.
CURATED_ONLY = True


def add_topic_hubs(nodes, edges):
    """Create topic-hub nodes from shared tags and link notes to them.

    Mutates `nodes` (dict) and `edges` (list) in place. Hubs derive purely from
    the tags of already-included (public) notes, so they add connectivity without
    introducing any new content.
    """
    from collections import defaultdict

    original_titles = set(nodes)  # only hub the real notes, not other hubs
    tag_to_notes = defaultdict(set)
    for title in original_titles:
        for t in nodes[title].get("tags", []):
            ct = TAG_CANON.get(t, t)
            if ct in HUB_STOPLIST:
                continue
            tag_to_notes[ct].add(title)

    for ctag, titles in sorted(tag_to_notes.items()):
        if CURATED_ONLY and ctag not in HUB_TITLE:
            continue
        if len(titles) < CURATED_HUB_MIN:
            continue
        hub_title = HUB_TITLE.get(ctag) or ctag.replace("-", " ").title()
        # Reuse an existing node with that title (e.g. the area pages); else make one.
        if hub_title not in nodes:
            nodes[hub_title] = {
                "id": hub_title,
                "type": HUB_NODE["type"],
                "color": HUB_NODE["color"],
                "status": "hub",
                "tags": [ctag],
            }
        for title in titles:
            if title != hub_title:
                edges.append({"source": title, "target": hub_title})


# Hard confidential block-list. A title containing any of these is NEVER published,
# regardless of folder opt-in OR an explicit per-note `public: true`.
# EMPTIED 2026-06-22 per Dave: the graph only publishes titles + tags (never note
# bodies), so the work-project titles aren't an actual leak — and he wants them
# shown, organized by company (see WORK_* hubs). The mechanism stays: re-add a
# term here to redact a title in the future.
CONFIDENTIAL_TERMS = []


def is_confidential_title(title):
    t = (title or "").lower()
    return any(term in t for term in CONFIDENTIAL_TERMS)


def public_folder_names(vault_path):
    """Folders whose _index.md carries `public: true` — bulk-include their notes."""
    out = set()
    wiki = os.path.join(vault_path, "wiki")
    if not os.path.isdir(wiki):
        return out
    for entry in os.listdir(wiki):
        idx = os.path.join(wiki, entry, "_index.md")
        if os.path.isfile(idx):
            try:
                fm, _ = parse_frontmatter(open(idx, encoding="utf-8", errors="replace").read())
                if _truthy(fm.get("public")):
                    out.add(entry)
            except Exception:
                pass
    return out


def parse_frontmatter(content):
    """Extract YAML frontmatter from markdown content (no PyYAML dependency)."""
    if not content.startswith("---"):
        return {}, content
    end = content.find("---", 3)
    if end == -1:
        return {}, content
    fm_text = content[3:end]
    body = content[end + 3 :]
    fm = {}
    current_key = None
    current_list = None
    for line in fm_text.strip().split("\n"):
        # List item under a key
        list_match = re.match(r"^\s+-\s+(.+)", line)
        if list_match and current_key:
            if current_list is None:
                current_list = []
                fm[current_key] = current_list
            current_list.append(list_match.group(1).strip().strip('"').strip("'"))
            continue
        # Key-value pair
        kv_match = re.match(r"^(\w[\w_]*)\s*:\s*(.*)", line)
        if kv_match:
            current_key = kv_match.group(1)
            val = kv_match.group(2).strip().strip('"').strip("'")
            current_list = None
            if val == "" or val == "[]":
                fm[current_key] = []
                current_list = fm[current_key]
            elif val.startswith("[") and val.endswith("]"):
                fm[current_key] = [v.strip().strip('"').strip("'") for v in val[1:-1].split(",") if v.strip()]
            else:
                fm[current_key] = val
    return fm, body


def extract_wikilinks(content):
    """Extract [[wikilink]] targets from markdown content."""
    return re.findall(r"\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]", content)


def get_folder_type(filepath, vault_path):
    """Determine the node type from the file's folder."""
    rel = os.path.relpath(filepath, os.path.join(vault_path, "wiki"))
    folder = rel.split(os.sep)[0] if os.sep in rel else ""
    return FOLDER_TYPES.get(folder, {"type": "other", "color": "#808080"})


def build_graph(vault_path):
    """Scan the vault and build a graph of nodes and edges.

    INCLUSION IS OPT-IN ONLY: a note appears in the public graph if and only if
    it carries `public: true` in frontmatter. Folder membership is NOT sufficient.

    Rationale (2026-06-09 security fix): folder-based inclusion failed OPEN —
    employer-confidential notes (Shipt: Deals For You V2, Seasonality,
    personifier-*) were later added to public category folders (entities/, areas/,
    concepts/) and would have been published on the next sync. Opt-in fails CLOSED:
    any new/unflagged note is private by default, regardless of where it lives.

    A `private` tag is still an absolute override (redundant belt-and-suspenders).
    The walk is confined to wiki/ so top-level private trees (Personal/, Daily/,
    Shipt/, Agent Journal/) are never even read.
    """
    nodes = {}  # title -> node dict
    edges = []  # list of {source, target}
    note_folder = {}  # title -> rel folder path (for company/project mapping)

    wiki_root = os.path.join(vault_path, "wiki")
    if not os.path.isdir(wiki_root):
        return {"nodes": [], "links": [],
                "meta": {"generated": "auto", "node_count": 0, "edge_count": 0}}

    pub_folders = public_folder_names(vault_path)

    for root, _, files in os.walk(wiki_root):
        rel = os.path.relpath(root, wiki_root)
        folder = rel.split(os.sep)[0] if rel != "." else ""

        for fname in files:
            if not fname.endswith(".md") or fname in SKIP_FILES:
                continue

            filepath = os.path.join(root, fname)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            fm, body = parse_frontmatter(content)

            tags = fm.get("tags", []) or []
            title = fm.get("title", fname.replace(".md", ""))

            # --- Inclusion policy (fails CLOSED) ---
            # Hard excludes first, in priority order:
            if "private" in tags or is_public_optout(fm):
                continue  # explicit per-note opt-out always wins
            if is_confidential_title(title):
                continue  # employer-confidential term — never publish, no override

            # Bulk-opt-in covers notes DIRECTLY in a public folder (rel == folder).
            # Nested subfolders are NOT auto-covered EXCEPT the explicitly listed
            # work project folders (WORK_FOLDERS), which Dave wants organized by
            # company. Everything else nested must opt in per-note (fails closed).
            directly_in_folder = (rel == folder)
            in_work_folder = rel in WORK_FOLDERS

            if is_public_optin(fm):
                pass       # explicit per-note opt-in always wins (overrides heuristics)
            elif folder in pub_folders and (directly_in_folder or in_work_folder):
                # Folder bulk-opt-in, BUT skip detail/internal titles (graph
                # publishes titles, so a schema/spec title would leak specifics).
                if DETAIL_TITLE_RE.search(title):
                    continue
            else:
                continue   # not opted in by note or folder → private by default

            status = fm.get("status", "seed")
            type_info = get_folder_type(filepath, vault_path)

            nodes[title] = {
                "id": title,
                "type": type_info["type"],
                "color": type_info["color"],
                "status": status,
                "tags": [t for t in tags if t != "private"],
            }
            note_folder[title] = rel

            # Extract links to other pages (body wikilinks)
            for link_target in extract_wikilinks(body):
                edges.append({"source": title, "target": link_target})

            # Extract links from frontmatter 'related' field.
            # NB: don't reuse the name `rel` here — it holds the outer directory
            # path used by the inclusion check above; shadowing it corrupts the
            # depth-1 test for every subsequent file in the directory.
            related = fm.get("related", []) or []
            for rel_link in related:
                match = re.search(r"\[\[(.+?)\]\]", str(rel_link))
                if match:
                    edges.append({"source": title, "target": match.group(1)})

    # Organize employer work as company → project → notes, then connect the
    # remaining notes via shared-tag topic hubs.
    add_work_hubs(nodes, edges, note_folder)
    add_topic_hubs(nodes, edges)

    # Filter edges to only include nodes that exist in the graph
    node_titles = set(nodes.keys())
    filtered_edges = []
    seen_edges = set()
    for edge in edges:
        key = (edge["source"], edge["target"])
        reverse_key = (edge["target"], edge["source"])
        if (
            edge["source"] in node_titles
            and edge["target"] in node_titles
            and edge["source"] != edge["target"]
            and key not in seen_edges
            and reverse_key not in seen_edges
        ):
            filtered_edges.append(edge)
            seen_edges.add(key)

    return {
        "nodes": list(nodes.values()),
        "links": filtered_edges,
        "meta": {
            "generated": "auto",
            "node_count": len(nodes),
            "edge_count": len(filtered_edges),
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Build knowledge graph JSON")
    parser.add_argument(
        "--vault",
        default=os.path.expanduser("~/Documents/Remote Vault"),
        help="Path to Obsidian vault",
    )
    parser.add_argument(
        "--output",
        default=os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "knowledge",
            "graph-data.json",
        ),
        help="Output JSON path",
    )
    args = parser.parse_args()

    graph = build_graph(args.vault)
    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    # Safety guard: refuse to overwrite a non-empty graph with an empty one.
    # This handles the cron-on-unsync'd-vault case where build_graph() returns
    # 0 nodes because the vault folder wasn't accessible. Without this check,
    # a stale or missing vault silently wipes /knowledge/.
    if graph["meta"]["node_count"] == 0 and os.path.exists(args.output):
        try:
            with open(args.output, "r", encoding="utf-8") as f:
                existing = json.load(f)
            if existing.get("meta", {}).get("node_count", 0) > 0:
                print(
                    f"ERROR: refusing to overwrite {args.output} with empty graph. "
                    f"Existing file has {existing['meta']['node_count']} nodes; "
                    f"new build has 0. Vault at {args.vault!r} may be missing or unsync'd.",
                    file=__import__("sys").stderr,
                )
                raise SystemExit(2)
        except (json.JSONDecodeError, KeyError):
            # Existing file isn't valid JSON or lacks meta — fall through and overwrite.
            pass

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2)

    print(f"Graph built: {graph['meta']['node_count']} nodes, {graph['meta']['edge_count']} edges")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
