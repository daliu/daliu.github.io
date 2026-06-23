#!/Users/daveliu/.virtualenvs/trade_predict/bin/python
"""Keep the health-dashboard credentials warm and the calendar feed fresh.

Runs daily (launchd: com.daveliu.keep-credentials-warm). Four jobs:

1. Google Calendar OAuth — exercise the token by regenerating
   health/calendar.json via fetch_calendar_history.py. The fetch refreshes the
   OAuth access token as a side effect, which keeps the refresh token from going
   stale. Nothing else used this token on a schedule, so calendar.json silently
   froze (2026-05-06 -> 2026-05-31) once the token lapsed; this prevents recurrence.

2. Garmin SSO — load the cached garth token, make one authenticated call, and
   persist the refreshed token. health-tracker already does this hourly; doing it
   here too gives an explicit daily liveness signal we can alert on.

3. Garmin watch-sync watchdog — the credential being healthy does NOT mean fresh
   data is arriving. If the watch stops syncing to Garmin Connect, the hourly
   health-tracker cron keeps running but writes nothing new, and the dashboard
   silently freezes (this happened 2026-05-19 and again 2026-06-19). We read the
   newest watch-sync timestamp the pipeline has captured and alert if it's gone
   cold, so Dave knows to open Garmin Connect before the dashboard goes stale.

4. Commit + push a changed calendar.json so the live dashboard updates.

Credentials can't be re-authed non-interactively, and a cold watch can't be
synced from here either. When something needs Dave's hands we fire a macOS
notification (and record status) so the one-time manual fix can be run:

    Google:  ~/scripts/gcal-reauth        (browser consent)
    Garmin:  ~/scripts/garmin-setup       (re-enter password / MFA)
    Watch:   charge/wear it + open the Garmin Connect mobile app to sync

Note: a stale calendar/Garmin *credential* is different from the Garmin *watch*
not syncing. Job 2 covers the former, job 3 the latter — auth can be perfectly
healthy while biometrics are missing because the watch hasn't uploaded.

Usage:
    keep_credentials_warm.py            # full run (refresh, check, commit, push)
    keep_credentials_warm.py --no-push  # do everything except git commit/push
    keep_credentials_warm.py --quiet    # suppress macOS notifications (still logs)
"""

import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone

REPO = os.path.expanduser("~/Code/daliu.github.io")
VENV = os.path.expanduser("~/.virtualenvs/trade_predict/bin/python")
FETCH_CAL = os.path.join(REPO, "scripts", "fetch_calendar_history.py")
CAL_JSON = os.path.join(REPO, "health", "calendar.json")

GCAL_TOKEN = os.path.expanduser("~/.config/gcal/token.json")
GARMIN_TOKEN = os.path.expanduser("~/.config/garmin/token.json")
GARMIN_CREDS = os.path.expanduser("~/.config/garmin/credentials")

# Watch-sync watchdog: the hourly health-tracker stamps each captured row with
# Garmin's lastSyncTimestampGMT (GMT/naive). The freshest one tells us when the
# watch last actually uploaded. Past this many hours we assume the watch is cold
# and nag. 30h (not 24h) tolerates a normal once-a-day sync cadence drifting.
ADAPTIVE_DB = os.path.expanduser("~/.local/share/adaptive-schedule/adaptive.db")
WATCH_STALE_HOURS = 30

STATUS_DIR = os.path.expanduser("~/.config/health-pipeline")
STATUS_FILE = os.path.join(STATUS_DIR, "cred-status.json")

QUIET = "--quiet" in sys.argv
NO_PUSH = "--no-push" in sys.argv


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def notify(title, message):
    """Best-effort macOS banner. Quotes are stripped to keep osascript happy."""
    log(f"ALERT — {title}: {message}")
    if QUIET:
        return
    safe_t = title.replace('"', "").replace("\\", "")
    safe_m = message.replace('"', "").replace("\\", "")[:240]
    try:
        subprocess.run(
            ["osascript", "-e",
             f'display notification "{safe_m}" with title "{safe_t}"'],
            timeout=10, capture_output=True,
        )
    except Exception as e:
        log(f"(notification failed: {e})")


def refresh_calendar():
    """Run the fetcher (also refreshes the OAuth token). Returns (state, detail)."""
    if not os.path.isfile(FETCH_CAL):
        return "error", f"fetcher missing: {FETCH_CAL}"
    try:
        r = subprocess.run([VENV, FETCH_CAL], capture_output=True, text=True, timeout=150)
    except subprocess.TimeoutExpired:
        return "error", "calendar fetch timed out"
    out = (r.stdout + "\n" + r.stderr).strip()
    tail = out.splitlines()[-1] if out else "(no output)"
    if r.returncode == 0:
        return "ok", tail
    if "invalid_grant" in out or "expired or revoked" in out:
        return "needs_reauth", tail
    return "error", tail


def check_garmin():
    """Exercise + persist the garth token; report liveness. Returns (state, detail)."""
    if not os.path.exists(GARMIN_TOKEN):
        return "needs_reauth", "no cached Garmin token"
    if not os.path.exists(GARMIN_CREDS):
        return "error", "no Garmin credentials file"
    try:
        from garminconnect import Garmin
        email = open(GARMIN_CREDS).read().strip()
        client = Garmin(email)
        client.login(tokenstore=open(GARMIN_TOKEN).read())
        with open(GARMIN_TOKEN, "w") as f:
            f.write(client.garth.dumps())
        name = client.get_full_name()  # cheap authenticated call
        return "ok", f"token valid ({name})"
    except Exception as e:
        msg = str(e)[:200]
        if any(s in msg for s in ("401", "Unauthorized", "invalid", "expired", "login")):
            return "needs_reauth", msg
        return "error", msg


def _parse_gmt(ts):
    """Parse a Garmin lastSyncTimestampGMT string into an aware UTC datetime.

    Values look like '2026-06-19T15:23:35.883' (naive, GMT) but precision varies
    ('.50', '.82', or none), so fall back to a seconds-only parse.
    """
    try:
        dt = datetime.fromisoformat(ts)
    except ValueError:
        dt = datetime.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S")
    return dt.replace(tzinfo=timezone.utc)


def check_garmin_sync():
    """Alert if the watch hasn't synced to Garmin Connect recently.

    Reuses the timestamp the hourly cron already records, so this adds no Garmin
    API call. Returns (state, detail): 'ok' | 'stale' | 'error'.
    """
    if not os.path.exists(ADAPTIVE_DB):
        return "error", f"no adaptive db: {ADAPTIVE_DB}"
    try:
        conn = sqlite3.connect(f"file:{ADAPTIVE_DB}?mode=ro", uri=True)
        row = conn.execute(
            "SELECT MAX(last_sync_timestamp) FROM health_metrics_hourly "
            "WHERE last_sync_timestamp IS NOT NULL"
        ).fetchone()
        conn.close()
    except sqlite3.Error as e:
        return "error", f"db read failed: {e}"

    if not row or not row[0]:
        return "error", "no watch-sync timestamp recorded yet"

    last = _parse_gmt(row[0])
    age_h = (datetime.now(timezone.utc) - last).total_seconds() / 3600
    when = last.strftime("%Y-%m-%d %H:%M GMT")
    if age_h > WATCH_STALE_HOURS:
        return "stale", f"watch last synced {age_h:.0f}h ago ({when})"
    return "ok", f"watch synced {age_h:.0f}h ago ({when})"


def git_push_calendar():
    """Commit + push calendar.json if it changed. Mirrors publish-health-data."""
    os.chdir(REPO)
    changed = subprocess.run(
        ["git", "status", "--porcelain", "health/calendar.json"],
        capture_output=True, text=True,
    ).stdout.strip()
    if not changed:
        return "no change to push"
    subprocess.run(["git", "pull", "--rebase", "--autostash"], check=True,
                   capture_output=True, text=True)
    subprocess.run(["git", "add", "health/calendar.json"], check=True)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    subprocess.run(["git", "commit", "-m", f"health: refresh calendar density {stamp}"],
                   check=True, capture_output=True, text=True)
    subprocess.run(["git", "push"], check=True, capture_output=True, text=True)
    return "pushed"


def write_status(results):
    os.makedirs(STATUS_DIR, exist_ok=True)
    payload = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "google_calendar": {"state": results["calendar"][0], "detail": results["calendar"][1]},
        "garmin": {"state": results["garmin"][0], "detail": results["garmin"][1]},
        "garmin_watch_sync": {"state": results["garmin_sync"][0], "detail": results["garmin_sync"][1]},
    }
    with open(STATUS_FILE, "w") as f:
        json.dump(payload, f, indent=2)
    log(f"status -> {STATUS_FILE}")


def main():
    log("keep-credentials-warm starting")
    results = {}

    cal_state, cal_detail = refresh_calendar()
    log(f"calendar: {cal_state} — {cal_detail}")
    results["calendar"] = (cal_state, cal_detail)

    gar_state, gar_detail = check_garmin()
    log(f"garmin:   {gar_state} — {gar_detail}")
    results["garmin"] = (gar_state, gar_detail)

    sync_state, sync_detail = check_garmin_sync()
    log(f"watch:    {sync_state} — {sync_detail}")
    results["garmin_sync"] = (sync_state, sync_detail)

    if cal_state == "ok" and not NO_PUSH:
        try:
            log(f"git: {git_push_calendar()}")
        except subprocess.CalledProcessError as e:
            err = (e.stderr or str(e))[:200]
            log(f"git push failed: {err}")
            notify("Calendar publish failed", err)

    write_status(results)

    # Alerts: only nag for things that need Dave's hands.
    if cal_state == "needs_reauth":
        notify("Google Calendar needs re-auth",
               "Run ~/scripts/gcal-reauth — refresh token expired.")
    elif cal_state == "error":
        notify("Calendar refresh error", cal_detail)

    if gar_state == "needs_reauth":
        notify("Garmin needs re-auth",
               "Run ~/scripts/garmin-setup — SSO token rejected.")
    elif gar_state == "error":
        notify("Garmin check error", gar_detail)

    # Watch-sync is device-side (not a credential we can fix here), so it nags but
    # is kept out of the credential exit-code triage below.
    if sync_state == "stale":
        notify("Garmin watch not synced",
               f"{sync_detail}. Open Garmin Connect to restore dashboard data.")

    # Exit non-zero if anything needs attention (useful for launchd log triage).
    bad = {s for s, _ in results.values()} & {"needs_reauth", "error"}
    log("done" + (f" — attention: {', '.join(sorted(bad))}" if bad else " — all healthy"))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
