#!/usr/bin/env python3
"""One-off interactive Google Calendar re-auth.

Refreshes the pickled credentials at ~/.config/gcal/token.json by running
the OAuth installed-app flow against the existing client at
~/.config/gcal/credentials.json. Use this when build_daily_journal.py
reports `invalid_grant: Token has been expired or revoked`.

This script must run inside an env that has google-auth-oauthlib installed.
The simplest path is the same venv the rest of the pipeline uses:

    ~/.virtualenvs/trade_predict/bin/python scripts/reauth_gcal.py

It opens a browser window, you complete the consent flow, and the new
credentials get pickled back to disk in the same format the existing
daily-planner / build_daily_journal expect.
"""

import os
import pickle
import sys

CREDS = os.path.expanduser("~/.config/gcal/credentials.json")
TOKEN = os.path.expanduser("~/.config/gcal/token.json")
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


def main():
    if not os.path.isfile(CREDS):
        sys.exit(f"No client credentials at {CREDS}; download the desktop OAuth client JSON from Google Cloud Console first.")

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        sys.exit(
            "google-auth-oauthlib not importable in this Python.\n"
            "Run via: ~/.virtualenvs/trade_predict/bin/python scripts/reauth_gcal.py"
        )

    flow = InstalledAppFlow.from_client_secrets_file(CREDS, SCOPES)
    # run_local_server opens a browser to complete consent and stops a
    # tiny local HTTP server when Google redirects back.
    creds = flow.run_local_server(port=0)

    os.makedirs(os.path.dirname(TOKEN), exist_ok=True)
    with open(TOKEN, "wb") as f:
        pickle.dump(creds, f)
    print(f"Wrote refreshed credentials to {TOKEN}")


if __name__ == "__main__":
    main()
