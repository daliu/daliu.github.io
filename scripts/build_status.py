#!/usr/bin/env python3
"""Build a status snapshot for the /status page.

Reads git log, file mtimes, and the existing dashboard data files; emits
status/data.json. Run manually for now; could be wired into publish_daily.py
later if we want the snapshot to refresh on each daily run.

Usage:
    python scripts/build_status.py
"""

import json
import os
import subprocess
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "status", "data.json")


def _run(args):
    return subprocess.check_output(["git", "-C", REPO] + args, text=True).strip()


def _parse_log_lines(text):
    out = []
    for line in text.splitlines():
        parts = line.split("|", 2)
        if len(parts) == 3:
            out.append({"hash": parts[0], "date": parts[1], "message": parts[2]})
    return out


def latest_commit_for(path, ref="HEAD"):
    """Most recent commit touching `path` on the given ref."""
    text = _run(["log", "-n1", ref, "--pretty=format:%h|%cI|%s", "--", path])
    return _parse_log_lines(text)[0] if text else None


def latest_commit(ref="HEAD"):
    return _parse_log_lines(_run(["log", "-n1", ref, "--pretty=format:%h|%cI|%s"]))[0]


def recent_commits(limit=20, ref="HEAD"):
    return _parse_log_lines(_run(["log", f"-n{limit}", ref, "--pretty=format:%h|%cI|%s"]))


def count_files(dirpath, suffix=".html", exclude=("index.html",)):
    if not os.path.isdir(dirpath):
        return 0
    return sum(
        1 for f in os.listdir(dirpath)
        if f.endswith(suffix) and f not in exclude
    )


def graph_meta():
    p = os.path.join(REPO, "knowledge", "graph-data.json")
    if not os.path.exists(p):
        return {"node_count": 0, "edge_count": 0}
    with open(p) as f:
        d = json.load(f)
    return d.get("meta", {"node_count": 0, "edge_count": 0})


def health_meta():
    p = os.path.join(REPO, "health", "data.json")
    if not os.path.exists(p):
        return None
    with open(p) as f:
        d = json.load(f)
    return {"updated": d.get("updated"), "date_range": d.get("date_range")}


def analytics_meta():
    p = os.path.join(REPO, "analytics", "data.json")
    if not os.path.exists(p):
        return None
    with open(p) as f:
        try:
            d = json.load(f)
        except json.JSONDecodeError:
            return None
    return {"updated": d.get("updated") or d.get("generated_at")}


def main():
    snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "deploy": {
            "latest_commit": latest_commit(),
            "branch": "master",
        },
        "pipelines": {
            "autotrader_daily": {
                "name": "AutoTrader Daily",
                "url": "/autotrader/daily/",
                "schedule": "5:30 AM ET on weekdays",
                "page_count": count_files(os.path.join(REPO, "autotrader", "daily")),
                "last_commit": latest_commit_for("autotrader/daily/"),
            },
            "health_dashboard": {
                "name": "Health Dashboard",
                "url": "/health/",
                "schedule": "~19:00 ET daily",
                "data": health_meta(),
                "last_commit": latest_commit_for("health/"),
            },
            "knowledge_graph": {
                "name": "Knowledge Graph",
                "url": "/knowledge/",
                "schedule": "manual (run scripts/build_graph.py)",
                "graph": graph_meta(),
                "last_commit": latest_commit_for("knowledge/graph-data.json"),
            },
            "site_analytics": {
                "name": "Site Analytics",
                "url": "/analytics/",
                "schedule": "manual (run scripts/fetch_analytics.py)",
                "data": analytics_meta(),
                "last_commit": latest_commit_for("analytics/data.json"),
            },
        },
        "recent_commits": recent_commits(20),
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(snapshot, f, indent=2)
    print(f"Wrote {OUT} ({sum(1 for _ in snapshot['recent_commits'])} recent commits)")


if __name__ == "__main__":
    main()
