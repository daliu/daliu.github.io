#!/usr/bin/env python3
"""Build the Claude Journal in the Obsidian vault.

Reads ~/.claude/projects/*/[session-id].jsonl (Claude Code session
transcripts) and writes one markdown file per session to
`wiki/claude-sessions/` in the vault, plus an index.

Metadata-only: extracts titles, timestamps, turn counts, PR links,
git branches, and the first user prompt. Verbatim message content
is intentionally omitted — the raw transcripts can contain
credentials, error output, etc., and shouldn't be promoted into the
notes vault.

Idempotent. Safe to schedule.

Usage:
    python scripts/build_claude_journal.py
    python scripts/build_claude_journal.py --max-age-days 30
    python scripts/build_claude_journal.py --vault /alt/path
"""

import argparse
import json
import os
import re
from datetime import datetime, timedelta, timezone

DEFAULT_CLAUDE = os.path.expanduser("~/.claude/projects")
DEFAULT_VAULT = os.path.expanduser("~/Documents/Remote Vault")
DEFAULT_OUT_REL = "wiki/claude-sessions"

SESSION_FILE_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$"
)


def parse_session_file(path):
    """Walk a single .jsonl, return a metadata dict."""
    s = {
        "session_id": os.path.basename(path).replace(".jsonl", ""),
        "project_dirname": os.path.basename(os.path.dirname(path)),
        "first_ts": None,
        "last_ts": None,
        "first_user_prompt": None,
        "ai_titles": [],
        "pr_links": [],
        "branches": set(),
        "cwds": set(),
        "user_turns": 0,
        "assistant_turns": 0,
        "total_turn_duration_ms": 0,
        "version": None,
    }

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue

            t = d.get("type")
            ts = d.get("timestamp")
            if ts:
                if s["first_ts"] is None or ts < s["first_ts"]:
                    s["first_ts"] = ts
                if s["last_ts"] is None or ts > s["last_ts"]:
                    s["last_ts"] = ts

            if t == "user":
                s["user_turns"] += 1
                if s["first_user_prompt"] is None:
                    msg = d.get("message", {})
                    content = msg.get("content", "")
                    if (
                        isinstance(content, str)
                        and content.strip()
                        and not content.startswith("<")
                    ):
                        s["first_user_prompt"] = content[:280]
            elif t == "assistant":
                s["assistant_turns"] += 1
            elif t == "ai-title":
                title = d.get("aiTitle")
                if title and title not in s["ai_titles"]:
                    s["ai_titles"].append(title)
            elif t == "pr-link":
                s["pr_links"].append(
                    {
                        "number": d.get("prNumber"),
                        "url": d.get("prUrl"),
                        "repo": d.get("prRepository"),
                        "timestamp": d.get("timestamp"),
                    }
                )
            elif t == "system":
                if d.get("subtype") == "turn_duration":
                    s["total_turn_duration_ms"] += d.get("durationMs") or 0
                cwd = d.get("cwd")
                if cwd:
                    s["cwds"].add(cwd)
                gb = d.get("gitBranch")
                if gb:
                    s["branches"].add(gb)
                v = d.get("version")
                if v and not s["version"]:
                    s["version"] = v

    s["branches"] = sorted(s["branches"])
    s["cwds"] = sorted(s["cwds"])
    return s


def project_label(dirname, cwd=None):
    """Resolve to a readable project name.

    Claude Code encodes the project's absolute path as the directory name
    by replacing path separators (and dots) with dashes, which is lossy
    (`daliu.github.io` and `daliu-github-io` would map to the same dirname).
    When a `cwd` from a system message is available, prefer that.
    """
    if cwd:
        if cwd.startswith("/Users/daveliu/Code/"):
            return cwd[len("/Users/daveliu/Code/") :]
        if cwd.startswith("/Users/daveliu/"):
            return cwd[len("/Users/daveliu/") :]
        return cwd.lstrip("/")

    if dirname.startswith("-"):
        path = dirname.replace("-", "/").lstrip("/")
        if path.startswith("Users/daveliu/Code/"):
            return path[len("Users/daveliu/Code/") :]
        if path.startswith("Users/daveliu/"):
            return path[len("Users/daveliu/") :]
        return path
    return dirname


def project_slug(label):
    return label.replace("/", "-").replace(".", "-").lower()


def short_id(sid):
    return sid.split("-")[0]


def fmt_dt(iso):
    if not iso:
        return "—"
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime(
            "%Y-%m-%d %H:%M UTC"
        )
    except ValueError:
        return iso


def fmt_session_md(s):
    proj = project_label(s["project_dirname"], s["cwds"][0] if s["cwds"] else None)
    sid_short = short_id(s["session_id"])
    title = s["ai_titles"][0] if s["ai_titles"] else f"Session on {proj}"
    title = title.replace('"', "'")

    if s["first_ts"]:
        date_str = s["first_ts"][:10]
    else:
        date_str = "unknown"

    elapsed_str = "—"
    if s["first_ts"] and s["last_ts"]:
        first = datetime.fromisoformat(s["first_ts"].replace("Z", "+00:00"))
        last = datetime.fromisoformat(s["last_ts"].replace("Z", "+00:00"))
        hrs = (last - first).total_seconds() / 3600
        elapsed_str = f"{hrs:.1f}h elapsed"

    active_min = s["total_turn_duration_ms"] / 60000.0

    fm = [
        "---",
        "type: claude-session",
        f'title: "{title}"',
        f"date: {date_str}",
        f"session_id: {s['session_id']}",
        f"project: {proj}",
        f"user_turns: {s['user_turns']}",
        f"assistant_turns: {s['assistant_turns']}",
        f"prs: {len(s['pr_links'])}",
        "tags:",
        "  - claude-session",
        f"  - {project_slug(proj)}",
        "---",
        "",
        f"# {title}",
        "",
        f"Session `{sid_short}` on **{proj}**.",
        "",
        "## Timing",
        f"- Started: {fmt_dt(s['first_ts'])}",
        f"- Last active: {fmt_dt(s['last_ts'])}",
        f"- Wall clock: {elapsed_str}",
        f"- Cumulative turn time: {active_min:.1f} min ({s['user_turns']} user / {s['assistant_turns']} assistant turns)",
    ]
    if s["version"]:
        fm.append(f"- Claude Code version: {s['version']}")

    if len(s["ai_titles"]) > 1:
        fm.append("")
        fm.append("## Auto-titles seen")
        for t in s["ai_titles"][:20]:
            fm.append(f"- {t}")

    if s["branches"]:
        fm.append("")
        fm.append("## Git branches touched")
        fm.append(", ".join(f"`{b}`" for b in s["branches"]))

    if s["pr_links"]:
        fm.append("")
        fm.append("## PRs")
        seen = set()
        for pr in sorted(s["pr_links"], key=lambda p: p.get("timestamp") or ""):
            url = pr.get("url")
            if not url or url in seen:
                continue
            seen.add(url)
            fm.append(f"- [#{pr.get('number')} on {pr.get('repo')}]({url})")

    if s["first_user_prompt"]:
        fm.append("")
        fm.append("## First user prompt (truncated)")
        prompt = s["first_user_prompt"].replace("\n", " ").strip()
        fm.append("> " + prompt)

    fm.append("")
    return "\n".join(fm)


def main():
    p = argparse.ArgumentParser(description="Build the Claude Journal in the vault")
    p.add_argument("--claude-dir", default=DEFAULT_CLAUDE)
    p.add_argument("--vault", default=DEFAULT_VAULT)
    p.add_argument("--out-rel", default=DEFAULT_OUT_REL)
    p.add_argument(
        "--max-age-days",
        type=int,
        default=180,
        help="Skip sessions whose .jsonl mtime is older than this",
    )
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args()

    out_dir = os.path.join(args.vault, args.out_rel)
    os.makedirs(out_dir, exist_ok=True)

    cutoff = datetime.now(timezone.utc) - timedelta(days=args.max_age_days)

    sessions = []
    if not os.path.isdir(args.claude_dir):
        print(f"No Claude projects dir at {args.claude_dir}; nothing to do.")
        return

    for project_dir in sorted(os.listdir(args.claude_dir)):
        full = os.path.join(args.claude_dir, project_dir)
        if not os.path.isdir(full):
            continue
        for fn in sorted(os.listdir(full)):
            if not SESSION_FILE_RE.match(fn):
                continue
            path = os.path.join(full, fn)
            mtime = datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)
            if mtime < cutoff:
                continue
            sessions.append(parse_session_file(path))

    # Drop sessions with no actual user activity (e.g. permission-mode-only files).
    sessions = [s for s in sessions if s["user_turns"] > 0]
    sessions.sort(key=lambda s: s["last_ts"] or "")

    # Build a set of expected filenames so we can prune stale ones.
    expected = set()
    written = 0
    for s in sessions:
        first_ts = s["first_ts"] or "0000-00-00T00:00:00Z"
        date_part = first_ts[:10]
        sid_short = short_id(s["session_id"])
        slug = project_slug(project_label(s["project_dirname"], s["cwds"][0] if s["cwds"] else None))
        fname = f"{date_part}-{slug}-{sid_short}.md"
        expected.add(fname)
        with open(os.path.join(out_dir, fname), "w", encoding="utf-8") as f:
            f.write(fmt_session_md(s))
        written += 1

    # Prune previously-written session files that no longer have a source.
    pruned = 0
    for existing in os.listdir(out_dir):
        if existing == "_index.md":
            continue
        if existing.endswith(".md") and existing not in expected:
            try:
                os.remove(os.path.join(out_dir, existing))
                pruned += 1
            except OSError:
                pass

    # Index.
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    idx = [
        "---",
        "type: meta",
        'title: "Claude Sessions Index"',
        f"updated: {today}",
        "---",
        "",
        "# Claude Sessions",
        "",
        "Auto-generated by `scripts/build_claude_journal.py` (in the daliu.github.io repo). ",
        f"One entry per Claude Code session within the last {args.max_age_days} days.",
        "",
        f"_Last build: {now_str} · {len(sessions)} sessions_",
        "",
        "## Sessions (newest first)",
        "",
    ]
    for s in reversed(sessions):
        first_ts = s["first_ts"] or ""
        date_part = first_ts[:10]
        sid_short = short_id(s["session_id"])
        proj = project_label(s["project_dirname"], s["cwds"][0] if s["cwds"] else None)
        slug = project_slug(proj)
        link = f"{date_part}-{slug}-{sid_short}"
        title = s["ai_titles"][0] if s["ai_titles"] else "(no title)"
        pr_count = len(s["pr_links"])
        pr_str = f" · {pr_count} PR{'s' if pr_count != 1 else ''}" if pr_count else ""
        idx.append(
            f"- {date_part} · **{proj}** · [[{link}|{title}]] · {s['user_turns']}/{s['assistant_turns']} turns{pr_str}"
        )
    idx.append("")
    with open(os.path.join(out_dir, "_index.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(idx))

    if not args.quiet:
        print(
            f"Wrote {written} session pages + index to {out_dir}"
            + (f"; pruned {pruned} stale" if pruned else "")
        )


if __name__ == "__main__":
    main()
