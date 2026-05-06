#!/usr/bin/env python3
"""Build a daily roll-up journal entry for Dave.

For a given date (default today), aggregates:
- Git commits authored by Dave across all repos under ~/Code/*
- Garmin biometrics for that day from this repo's health/data.json
- A preserved manual-notes block (kept on regeneration)

Writes to `wiki/daily/<YYYY-MM-DD>.md` in the Obsidian vault.

Idempotent. Safe to schedule.

Usage:
    python scripts/build_daily_journal.py                 # today
    python scripts/build_daily_journal.py --date 2026-05-05
    python scripts/build_daily_journal.py --backfill 30   # last 30 days
"""

import argparse
import json
import os
import re
import subprocess
from datetime import date, datetime, timedelta

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_VAULT = os.path.expanduser("~/Documents/Remote Vault")
DEFAULT_OUT_REL = "wiki/daily"
DEFAULT_REPOS_ROOT = os.path.expanduser("~/Code")
HEALTH_DATA = os.path.join(REPO, "health", "data.json")

# Calendar fetch shells out to a venv that has google-api-python-client +
# google-auth-oauthlib so we can reuse the existing pickled credentials
# at ~/.config/gcal/token.json (same pattern as Dave's `daily-planner`
# script). When the venv or credentials aren't there, calendar fetch
# silently no-ops and the daily entry just shows the placeholder.
DEFAULT_GCAL_VENV = os.path.expanduser("~/.virtualenvs/trade_predict/bin/python")
DEFAULT_GCAL_TOKEN = os.path.expanduser("~/.config/gcal/token.json")

# Heuristic: a commit author belongs to Dave if their email contains any of
# these substrings. Conservative — adjust as needed.
DAVE_EMAIL_HINTS = ("daveliu", "7david12liu", "dave.liu", "dliu")

NOTES_START = "<!-- MANUAL-NOTES-START -->"
NOTES_END = "<!-- MANUAL-NOTES-END -->"


def list_git_repos(root):
    """Return absolute paths of git repos directly under `root`."""
    out = []
    if not os.path.isdir(root):
        return out
    for name in sorted(os.listdir(root)):
        full = os.path.join(root, name)
        if os.path.isdir(os.path.join(full, ".git")):
            out.append(full)
    return out


def commits_for_repo(repo_path, target_date, email_hints=DAVE_EMAIL_HINTS):
    """Return Dave's commits in `repo_path` on `target_date` (a date object).

    Uses --all so we don't miss work on feature branches that weren't merged
    to the default branch. Each commit is returned at most once even if it
    appears on multiple refs.
    """
    since = target_date.isoformat() + " 00:00:00"
    until = target_date.isoformat() + " 23:59:59"
    try:
        # Use TZ-local boundaries: --since/--until are interpreted in the
        # repo's local timezone, which matches how Dave thinks about a "day".
        result = subprocess.run(
            [
                "git",
                "-C",
                repo_path,
                "log",
                "--all",
                "--no-merges",
                f"--since={since}",
                f"--until={until}",
                "--pretty=format:%H%x09%cI%x09%aE%x09%s",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return []
    if result.returncode != 0:
        return []

    seen_hashes = set()
    commits = []
    for line in result.stdout.splitlines():
        parts = line.split("\t", 3)
        if len(parts) != 4:
            continue
        sha, iso_date, email, subject = parts
        if sha in seen_hashes:
            continue
        seen_hashes.add(sha)
        if email_hints and not any(h in email.lower() for h in email_hints):
            continue
        commits.append(
            {"sha": sha, "short": sha[:7], "date": iso_date, "email": email, "subject": subject}
        )
    return commits


CALENDAR_FETCH_SCRIPT = r"""
import json, os, pickle, sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

token_file = os.environ['GCAL_TOKEN']
target_iso = os.environ['GCAL_DATE']  # YYYY-MM-DD
tz_override = os.environ.get('GCAL_TZ_OVERRIDE') or ''  # empty = use user's primary calendar tz

try:
    with open(token_file, 'rb') as f:
        creds = pickle.load(f)
    if creds and creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        with open(token_file, 'wb') as f:
            pickle.dump(creds, f)

    from googleapiclient.discovery import build
    service = build('calendar', 'v3', credentials=creds, cache_discovery=False)

    # Resolve timezone once: explicit override wins, otherwise ask the API
    # for the user's primary calendar tz. We use the same tz for the query
    # window bounds and for display so "today" matches the user's day.
    if tz_override:
        tz_name = tz_override
    else:
        try:
            tz_name = service.settings().get(setting='timezone').execute().get('value', 'UTC')
        except Exception:
            tz_name = 'UTC'

    tz = ZoneInfo(tz_name)
    y, m, d = (int(p) for p in target_iso.split('-'))
    day_start = datetime(y, m, d, tzinfo=tz)
    day_end   = day_start + timedelta(days=1)

    resp = service.events().list(
        calendarId='primary',
        timeMin=day_start.isoformat(),
        timeMax=day_end.isoformat(),
        maxResults=100,
        singleEvents=True,
        orderBy='startTime',
    ).execute()

    out = []
    for e in resp.get('items', []):
        if e.get('status') == 'cancelled':
            continue
        # Skip events the user declined
        attendees = e.get('attendees') or []
        skip = False
        for a in attendees:
            if a.get('self') and a.get('responseStatus') == 'declined':
                skip = True
                break
        if skip:
            continue
        start = e['start'].get('dateTime') or e['start'].get('date')
        end   = e['end'].get('dateTime')   or e['end'].get('date')
        out.append({
            'summary': e.get('summary', '(no title)'),
            'start': start,
            'end': end,
            'all_day': 'T' not in (start or ''),
        })
    print(json.dumps({'events': out, 'tz': tz_name}))
except Exception as e:
    print(json.dumps({'__error__': str(e)}))
"""


def fetch_calendar(target_date, venv_python=DEFAULT_GCAL_VENV,
                   token_file=DEFAULT_GCAL_TOKEN, tz_override=""):
    """Return (events, reason, tz_name) — `events` is list[dict] or None.

    `reason` is None on success or a short string for the placeholder.
    `tz_name` is the timezone the fetcher used (resolved from the user's
    primary calendar if `tz_override` is empty); the caller uses it for
    display so the times match the day-window the API was queried with.
    """
    if not os.path.isfile(venv_python):
        return None, f"venv missing at {venv_python}", None
    if not os.path.isfile(token_file):
        return None, f"no token at {token_file}", None
    env = {
        **os.environ,
        "GCAL_TOKEN": token_file,
        "GCAL_DATE": target_date.isoformat(),
        "GCAL_TZ_OVERRIDE": tz_override,
    }
    try:
        result = subprocess.run(
            [venv_python, "-c", CALENDAR_FETCH_SCRIPT],
            capture_output=True,
            text=True,
            env=env,
            timeout=20,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return None, f"subprocess failed: {e}", None
    if result.returncode != 0:
        return None, f"venv python exited {result.returncode}: {result.stderr[:200]}", None
    try:
        data = json.loads(result.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError):
        return None, "could not parse fetcher output", None
    if isinstance(data, dict) and "__error__" in data:
        return None, data["__error__"][:200], None
    if not isinstance(data, dict) or "events" not in data:
        return None, "fetcher returned unexpected shape", None
    return data["events"], None, data.get("tz")


def fmt_calendar_section(events, reason=None, tz_name=None):
    if events is None:
        if reason and "invalid_grant" in reason:
            return [
                "_Calendar fetch failed: OAuth token expired or revoked. "
                "Re-authenticate by running `scripts/reauth_gcal.py` from "
                "this repo (one-off interactive flow). The token at "
                "`~/.config/gcal/token.json` will be refreshed in place._"
            ]
        if reason:
            return [f"_Calendar fetch unavailable: {reason}_"]
        return ["_Calendar fetch unavailable._"]
    if not events:
        return ["_No calendar events for this day._"]

    from zoneinfo import ZoneInfo
    tz = ZoneInfo(tz_name or "UTC")
    rows = []
    timed = [e for e in events if not e.get("all_day")]
    all_day = [e for e in events if e.get("all_day")]

    if all_day:
        rows.append("**All day**")
        for e in all_day:
            rows.append(f"- {e.get('summary', '(no title)')}")
        if timed:
            rows.append("")

    for e in timed:
        start = e.get("start", "")
        try:
            dt = datetime.fromisoformat(start.replace("Z", "+00:00")).astimezone(tz)
            t = dt.strftime("%I:%M %p").lstrip("0")
        except (ValueError, AttributeError):
            t = "?"
        rows.append(f"- **{t}** — {e.get('summary', '(no title)')}")
    return rows


def health_for_date(target_date):
    """Pull the day's Garmin row from health/data.json, or None."""
    if not os.path.exists(HEALTH_DATA):
        return None
    with open(HEALTH_DATA, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return None
    iso = target_date.isoformat()
    for row in data.get("daily", []):
        if row.get("date") == iso:
            return row
    return None


def preserve_notes(out_path):
    """Read the existing daily file (if any) and return the manual-notes content
    so the next regen doesn't clobber what Dave wrote."""
    if not os.path.exists(out_path):
        return ""
    with open(out_path, "r", encoding="utf-8") as f:
        text = f.read()
    m = re.search(
        re.escape(NOTES_START) + r"\s*\n(.*?)\n\s*" + re.escape(NOTES_END),
        text,
        re.DOTALL,
    )
    return m.group(1).strip() if m else ""


def fmt_health_section(h):
    if not h:
        return ["_No Garmin data for this day._"]
    rows = []

    def line(label, value, unit=""):
        if value is None or value == "":
            return
        rows.append(f"- **{label}**: {value}{unit}")

    line("Sleep", h.get("sleep_hours"), " h")
    if h.get("sleep_score") is not None:
        rows.append(f"- **Sleep score**: {h['sleep_score']}")
    line("Resting HR", h.get("resting_hr"), " bpm")
    line("HRV (last night)", h.get("hrv_last_night"), " ms")
    line("HRV (weekly)", h.get("hrv_weekly"), " ms")
    line("HRV status", h.get("hrv_status"))
    if h.get("min_body_battery") is not None and h.get("max_body_battery") is not None:
        rows.append(
            f"- **Body Battery**: {h['min_body_battery']} → {h['max_body_battery']} (avg {h.get('avg_body_battery', '—')})"
        )
    line("Stress avg", h.get("avg_stress"))
    line("Steps", f"{h['total_steps']:,}" if h.get("total_steps") else None)
    if h.get("distance_meters"):
        km = h["distance_meters"] / 1000
        rows.append(f"- **Distance**: {km:.2f} km")
    line("Active calories", h.get("active_calories"))
    line("Intensity minutes", h.get("intensity_minutes"))
    line("Vigorous minutes", h.get("vigorous_minutes"))
    return rows or ["_No Garmin fields populated for this day._"]


def fmt_commits_section(commits_by_repo):
    if not any(commits_by_repo.values()):
        return ["_No commits authored by Dave on this day._"]
    total = sum(len(c) for c in commits_by_repo.values())
    repos_with_activity = sum(1 for c in commits_by_repo.values() if c)
    rows = [
        f"**{total} commit{'s' if total != 1 else ''} across {repos_with_activity} repo{'s' if repos_with_activity != 1 else ''}**",
        "",
    ]
    for repo_name in sorted(commits_by_repo.keys()):
        commits = commits_by_repo[repo_name]
        if not commits:
            continue
        rows.append(f"### {repo_name} ({len(commits)})")
        for c in commits:
            time_part = c["date"][11:16] if len(c["date"]) >= 16 else ""
            subject = c["subject"].replace("|", "\\|")
            rows.append(f"- `{c['short']}` {time_part} — {subject}")
        rows.append("")
    return rows


def build_entry(target_date, repos_root):
    iso = target_date.isoformat()
    out_dir = None  # filled by caller

    health = health_for_date(target_date)

    repos = list_git_repos(repos_root)
    commits_by_repo = {}
    for repo_path in repos:
        commits = commits_for_repo(repo_path, target_date)
        if commits:
            commits_by_repo[os.path.basename(repo_path)] = commits

    weekday = target_date.strftime("%A")
    fm = [
        "---",
        "type: daily",
        f"date: {iso}",
        f"day: {weekday}",
        f"created: {iso}",
        f"updated: {datetime.now().date().isoformat()}",
        "tags:",
        "  - daily",
        "---",
        "",
        f"# {iso} ({weekday})",
        "",
    ]
    return fm, health, commits_by_repo


def render(target_date, manual_notes, health, commits_by_repo, calendar_section):
    iso = target_date.isoformat()
    weekday = target_date.strftime("%A")
    parts = [
        "---",
        "type: daily",
        f"date: {iso}",
        f"day: {weekday}",
        f"created: {iso}",
        f"updated: {datetime.now().date().isoformat()}",
        "tags:",
        "  - daily",
        "---",
        "",
        f"# {iso} · {weekday}",
        "",
        "## Notes",
        NOTES_START,
        manual_notes if manual_notes else "_(write here — preserved across regenerations)_",
        NOTES_END,
        "",
        "## Health",
    ]
    parts.extend(fmt_health_section(health))
    parts.append("")
    parts.append("## Code")
    parts.extend(fmt_commits_section(commits_by_repo))
    parts.append("## Calendar")
    parts.extend(calendar_section)
    parts.append("")
    return "\n".join(parts)


def main():
    p = argparse.ArgumentParser(description="Build the daily journal in the vault")
    p.add_argument("--date", help="YYYY-MM-DD; default today")
    p.add_argument("--backfill", type=int, default=0, help="Build the last N days")
    p.add_argument("--vault", default=DEFAULT_VAULT)
    p.add_argument("--out-rel", default=DEFAULT_OUT_REL)
    p.add_argument("--repos-root", default=DEFAULT_REPOS_ROOT)
    p.add_argument(
        "--no-calendar",
        action="store_true",
        help="Skip the calendar fetch (e.g. when offline or in CI)",
    )
    p.add_argument(
        "--tz",
        default="",
        help="Override timezone for calendar query bounds + display (default: user's primary calendar tz from API)",
    )
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args()

    if args.date and args.backfill:
        p.error("Use --date or --backfill, not both.")

    if args.date:
        try:
            target = date.fromisoformat(args.date)
        except ValueError:
            p.error(f"Invalid --date: {args.date!r}")
        targets = [target]
    elif args.backfill > 0:
        today = date.today()
        targets = [today - timedelta(days=i) for i in range(args.backfill)]
    else:
        targets = [date.today()]

    out_dir = os.path.join(args.vault, args.out_rel)
    os.makedirs(out_dir, exist_ok=True)

    written = 0
    for d in targets:
        out_path = os.path.join(out_dir, f"{d.isoformat()}.md")
        manual = preserve_notes(out_path)

        repos = list_git_repos(args.repos_root)
        commits_by_repo = {}
        for repo_path in repos:
            commits = commits_for_repo(repo_path, d)
            if commits:
                commits_by_repo[os.path.basename(repo_path)] = commits
        health = health_for_date(d)
        if args.no_calendar:
            events, reason, used_tz = None, "skipped (--no-calendar)", None
        else:
            events, reason, used_tz = fetch_calendar(d, tz_override=args.tz)
        cal_section = fmt_calendar_section(events, reason=reason, tz_name=used_tz)

        text = render(d, manual, health, commits_by_repo, cal_section)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)
        written += 1

    # Index
    index_lines = [
        "---",
        "type: meta",
        'title: "Daily Journal Index"',
        f"updated: {date.today().isoformat()}",
        "---",
        "",
        "# Daily Journal",
        "",
        "Auto-generated daily roll-ups by `scripts/build_daily_journal.py` (in the daliu.github.io repo). Combines git commits, Garmin biometrics, and a preserved manual-notes block.",
        "",
    ]
    existing = sorted(
        [
            f
            for f in os.listdir(out_dir)
            if f != "_index.md" and f.endswith(".md") and re.match(r"\d{4}-\d{2}-\d{2}\.md$", f)
        ],
        reverse=True,
    )
    index_lines.append(f"_Total entries: {len(existing)}_")
    index_lines.append("")
    index_lines.append("## Recent")
    index_lines.append("")
    for fn in existing[:60]:
        d = fn[:-3]
        try:
            wd = date.fromisoformat(d).strftime("%a")
        except ValueError:
            wd = ""
        index_lines.append(f"- [[{d}]] · {wd}")
    index_lines.append("")
    with open(os.path.join(out_dir, "_index.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(index_lines))

    if not args.quiet:
        print(f"Wrote {written} daily entr{'ies' if written != 1 else 'y'} to {out_dir}")


if __name__ == "__main__":
    main()
