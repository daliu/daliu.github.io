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


def is_public_optin(fm):
    """True if a note explicitly opts into the public graph via `public: true`.

    The frontmatter parser stores scalars as strings, so accept the common
    truthy spellings case-insensitively.
    """
    v = fm.get("public")
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("true", "yes", "1")
    return False


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

    wiki_root = os.path.join(vault_path, "wiki")
    if not os.path.isdir(wiki_root):
        return {"nodes": [], "links": [],
                "meta": {"generated": "auto", "node_count": 0, "edge_count": 0}}

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
            # Hard kill-switch: a private tag always excludes (redundant with opt-in).
            if "private" in tags:
                continue

            # Inclusion rule: OPT-IN ONLY. `public: true` is the sole gate.
            # Folder membership is deliberately NOT sufficient (see docstring) —
            # this fails closed so confidential notes dropped into public folders
            # are never published unless explicitly flagged.
            if not is_public_optin(fm):
                continue

            title = fm.get("title", fname.replace(".md", ""))
            status = fm.get("status", "seed")
            type_info = get_folder_type(filepath, vault_path)

            nodes[title] = {
                "id": title,
                "type": type_info["type"],
                "color": type_info["color"],
                "status": status,
                "tags": [t for t in tags if t != "private"],
            }

            # Extract links to other pages (body wikilinks)
            for link_target in extract_wikilinks(body):
                edges.append({"source": title, "target": link_target})

            # Extract links from frontmatter 'related' field
            related = fm.get("related", []) or []
            for rel in related:
                match = re.search(r"\[\[(.+?)\]\]", str(rel))
                if match:
                    edges.append({"source": title, "target": match.group(1)})

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
