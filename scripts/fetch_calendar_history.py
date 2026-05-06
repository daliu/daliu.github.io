#!/usr/bin/env python3
"""Pull the last N days of Google Calendar event counts to health/calendar.json.

Privacy: ships counts ONLY (per-day total events). No titles, no times,
no descriptions, no attendees. The dashboard uses this for a
calendar-density visualisation alongside biometrics — it doesn't need
event details to surface "your busiest days lately."

Reuses Dave's existing OAuth at ~/.config/gcal/{credentials,token}.json.
Runs inside the trade_predict venv (same pattern as build_daily_journal).

Usage:
    python scripts/fetch_calendar_history.py
    python scripts/fetch_calendar_history.py --days 30
    python scripts/fetch_calendar_history.py --output /path/to/output.json
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import date, datetime, timedelta

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO, "health", "calendar.json")
DEFAULT_VENV = os.path.expanduser("~/.virtualenvs/trade_predict/bin/python")
DEFAULT_TOKEN = os.path.expanduser("~/.config/gcal/token.json")


# This runs inside the venv that has google-api-python-client. Reads the
# pickled creds, queries `freebusy` (cheaper than events.list since we only
# need counts) — but freebusy returns busy intervals, not event counts.
# We actually need events.list to count events. This script does that
# minimally and emits ONLY per-day counts back over stdout JSON.
INNER = r"""
import json, os, pickle, sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

token_file = os.environ['GCAL_TOKEN']
days = int(os.environ['DAYS'])

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
    tz_name = service.settings().get(setting='timezone').execute().get('value', 'UTC')
    tz = ZoneInfo(tz_name)

    today = datetime.now(tz).date()
    start_date = today - timedelta(days=days - 1)

    # Fetch the entire window in one call (events.list with the maximal
    # window), then bucket by local date. Cheaper than days many calls.
    window_start = datetime.combine(start_date, datetime.min.time(), tz)
    window_end   = datetime.combine(today + timedelta(days=1), datetime.min.time(), tz)

    items = []
    page_token = None
    while True:
        resp = service.events().list(
            calendarId='primary',
            timeMin=window_start.isoformat(),
            timeMax=window_end.isoformat(),
            maxResults=2500,
            singleEvents=True,
            orderBy='startTime',
            pageToken=page_token,
        ).execute()
        items.extend(resp.get('items', []))
        page_token = resp.get('nextPageToken')
        if not page_token:
            break

    counts = {}
    for e in items:
        if e.get('status') == 'cancelled':
            continue
        # Skip declined-by-self
        attendees = e.get('attendees') or []
        if any(a.get('self') and a.get('responseStatus') == 'declined' for a in attendees):
            continue
        s = e['start'].get('dateTime') or e['start'].get('date')
        if 'T' in s:
            d = datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(tz).date()
        else:
            # All-day event: stored as YYYY-MM-DD
            d = datetime.fromisoformat(s).date()
        key = d.isoformat()
        counts[key] = counts.get(key, 0) + 1

    out = {
        'generated_at': datetime.now(tz).isoformat(),
        'tz': tz_name,
        'days': days,
        'by_day': [
            {'date': (start_date + timedelta(days=i)).isoformat(),
             'count': counts.get((start_date + timedelta(days=i)).isoformat(), 0)}
            for i in range(days)
        ],
    }
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({'__error__': str(e)}))
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--output", default=DEFAULT_OUT)
    ap.add_argument("--venv", default=DEFAULT_VENV)
    ap.add_argument("--token", default=DEFAULT_TOKEN)
    args = ap.parse_args()

    if not os.path.isfile(args.venv):
        sys.exit(f"venv python not at {args.venv}")
    if not os.path.isfile(args.token):
        sys.exit(f"no token at {args.token}")

    env = {
        **os.environ,
        "GCAL_TOKEN": args.token,
        "DAYS": str(args.days),
    }
    result = subprocess.run(
        [args.venv, "-c", INNER],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )
    if result.returncode != 0:
        sys.exit(f"fetcher exited {result.returncode}: {result.stderr[:500]}")

    try:
        data = json.loads(result.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError):
        sys.exit("could not parse fetcher output")

    if "__error__" in data:
        sys.exit(f"fetcher error: {data['__error__']}")

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(
        f"Wrote {args.output} ({args.days} days, {sum(d['count'] for d in data['by_day'])} events)"
    )


if __name__ == "__main__":
    main()
