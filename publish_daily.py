#!/usr/bin/env python3
"""Publish daily AutoTrader email to daliu.github.io.

Usage:
    python publish_daily.py --date 2026-02-18 --source /tmp/email_preview_secret.html
    python publish_daily.py                    # defaults to today, /tmp/email_preview_secret.html
    python publish_daily.py --no-push          # skip git commit/push
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DAILY_DIR = os.path.join(SCRIPT_DIR, "autotrader", "daily")
EMAILS_DIR = os.path.join(DAILY_DIR, "emails")
INDEX_PATH = os.path.join(DAILY_DIR, "index.html")

ENTRY_START = "<!-- DAILY-ENTRIES -->"
ENTRY_END = "<!-- /DAILY-ENTRIES -->"


def parse_args():
    parser = argparse.ArgumentParser(description="Publish daily email to GitHub Pages")
    parser.add_argument(
        "--date",
        default=datetime.now().strftime("%Y-%m-%d"),
        help="Date in YYYY-MM-DD format (default: today)",
    )
    parser.add_argument(
        "--source",
        default="/tmp/email_preview_secret.html",
        help="Path to source email HTML (default: /tmp/email_preview_secret.html)",
    )
    parser.add_argument(
        "--no-push", action="store_true", help="Skip git commit and push"
    )
    return parser.parse_args()


def extract_description(email_html):
    """Extract key stats from email HTML for the index card description."""
    # Strip HTML tags for easier text matching
    text = re.sub(r"<[^>]+>", " ", email_html)
    text = re.sub(r"\s+", " ", text)

    parts = []

    # Ticker count: "Total Tickers: 630"
    m = re.search(r"Total Tickers\s*:\s*(\d+)", text)
    if m:
        parts.append(f"{m.group(1)} tickers analyzed")

    # Fear & Greed - Stock Market: "Stock Market: 40/100 - FEAR"
    m = re.search(r"Stock Market\s*:\s*(\d+)/100\s*[-\u2013]\s*([A-Z][A-Z ]*)", text)
    if m:
        score, label = m.group(1), m.group(2).strip()
        parts.append(f"Market sentiment: {label.title()} ({score}/100)")

    # Fear & Greed - Crypto: "Crypto Market: 9/100 - EXTREME FEAR"
    m = re.search(
        r"Crypto(?:\s+Market)?\s*:\s*(\d+)/100\s*[-\u2013]\s*([A-Z][A-Z ]*)", text
    )
    if m:
        score, label = m.group(1), m.group(2).strip()
        parts.append(f"Crypto: {label.title()} ({score}/100)")

    # Congress trades: "50 trades in last 14 days"
    m = re.search(r"(\d+)\s+trades?\s+in\s+last\s+\d+\s+days?", text)
    if m:
        parts.append(f"{m.group(1)} congress trades tracked")

    return (
        " &middot; ".join(parts)
        if parts
        else "Daily market predictions and analysis"
    )


def format_date_display(date_obj):
    """Format date as 'February 18, 2026 &middot; Wednesday'."""
    return f"{date_obj.strftime('%B')} {date_obj.day}, {date_obj.year} &middot; {date_obj.strftime('%A')}"


def format_month_header(date_obj):
    """Format month header like 'February 2026'."""
    return f"{date_obj.strftime('%B')} {date_obj.year}"


def generate_wrapper_page(date_str, date_obj):
    """Generate the wrapper HTML page for a daily email."""
    month_name = date_obj.strftime("%B")
    day = date_obj.day
    year = date_obj.year
    short_month = date_obj.strftime("%b")

    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta http-equiv="content-type" content="text/html; charset=UTF-8">
  <title>Daily Update - {short_month} {day}, {year} - AutoTrader</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="AutoTrader daily market predictions for {month_name} {day}, {year}">
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg">
  <link rel="stylesheet" href="../../Bootstrap%20Theme%20Company%20Page_files/bootstrap.css">
  <link href="../../Bootstrap%20Theme%20Company%20Page_files/css_002.css" rel="stylesheet" type="text/css">
  <link href="../../Bootstrap%20Theme%20Company%20Page_files/css.css" rel="stylesheet" type="text/css">
  <script src="../../Bootstrap%20Theme%20Company%20Page_files/jquery.js"></script>
  <script src="../../Bootstrap%20Theme%20Company%20Page_files/bootstrap.js"></script>
  <script src="https://use.fontawesome.com/7c37a02403.js"></script>
  <style>
  body {{
      font: 400 15px Lato, sans-serif;
      line-height: 1.8;
      color: #818181;
  }}
  p {{ font-size: 16px; }}
  .bg-1 {{ background-color: #1abc9c; color: #ffffff; }}
  .bg-2 {{ background-color: #474e5d; color: #ffffff; }}
  .bg-3 {{ background-color: #ffffff; color: #555555; }}
  .bg-4 {{ background-color: #2f2f2f; color: #fff; }}
  h2 {{
      font-size: 24px;
      text-transform: uppercase;
      color: #303030;
      font-weight: 600;
      margin-bottom: 30px;
  }}
  .navbar {{
      margin-bottom: 0;
      background-color: #2f2f2f;
      z-index: 9999;
      border: 0;
      font-size: 12px !important;
      line-height: 1.42857143 !important;
      letter-spacing: 4px;
      border-radius: 0;
      font-family: Montserrat, sans-serif;
  }}
  .navbar li a, .navbar .navbar-brand {{ color: #fff !important; }}
  .navbar-nav li a:hover, .navbar-nav li.active a {{
      color: #1abc9c !important;
      background-color: #fff !important;
  }}
  .navbar-default .navbar-toggle {{ border-color: transparent; color: #fff !important; }}
  .container-fluid {{ padding: 60px 50px; }}
  .section-divider {{
      width: 60px;
      height: 3px;
      background: #1abc9c;
      margin: 0 0 30px 0;
  }}
  .bg-grey {{ background-color: #f6f6f6; }}
  .email-iframe {{
      width: 100%;
      border: none;
      min-height: 600px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }}
  .back-link {{
      display: inline-block;
      margin-bottom: 20px;
      color: #1abc9c;
      font-family: Montserrat, sans-serif;
      font-size: 13px;
      letter-spacing: 1px;
      text-decoration: none;
  }}
  .back-link:hover {{ color: #16a085; text-decoration: underline; }}
  .date-heading {{
      font-family: Montserrat, sans-serif;
      font-size: 14px;
      color: #1abc9c;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 5px;
  }}
  @media screen and (max-width: 768px) {{
    .container-fluid {{ padding: 40px 20px; }}
  }}
  </style>
</head>
<body>

<nav class="navbar navbar-default navbar-fixed-top">
  <div class="container">
    <div class="navbar-header">
      <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#myNavbar">
        <span class="icon-bar"></span>
        <span class="icon-bar"></span>
        <span class="icon-bar"></span>
      </button>
      <a class="navbar-brand" href="../../index.html">Dave Liu</a>
    </div>
    <div class="collapse navbar-collapse" id="myNavbar">
      <ul class="nav navbar-nav navbar-right">
        <li><a href="../../portfolio.html">Portfolio</a></li>
        <li><a href="../../index.html">Data</a></li>
        <li><a href="../../autotrader.html">AutoTrader</a></li>
        <li class="active"><a href="index.html">Daily Updates</a></li>
        <li><a href="https://www.linkedin.com/in/dave-liu-a3139775/" target="_blank"><span class="fa fa-linkedin"></span></a></li>
        <li><a href="https://github.com/daliu" target="_blank"><span class="fa fa-github"></span></a></li>
      </ul>
    </div>
  </div>
</nav>

<div style="height: 50px;"></div>

<div class="container-fluid">
  <a href="index.html" class="back-link">&larr; All Daily Updates</a>
  <div class="date-heading">{month_name} {day}, {year}</div>
  <h2>Daily Market Update</h2>
  <div class="section-divider"></div>
  <p>AutoTrader's daily predictions and market analysis for the upcoming trading day. This report includes top bullish and bearish picks, market sentiment indicators, economic calendar events, and social sentiment data.</p>

  <iframe src="emails/{date_str}.html" class="email-iframe" id="emailFrame"></iframe>
</div>

<footer class="container-fluid text-center" style="background: #2f2f2f; padding: 40px 50px; color: #95a5a6;">
  <div style="margin-bottom: 15px;">
    <a href="https://www.linkedin.com/in/dave-liu-a3139775/" target="_blank" style="color: #fff; margin: 0 12px; font-size: 20px;"><span class="fa fa-linkedin"></span></a>
    <a href="https://github.com/daliu" target="_blank" style="color: #fff; margin: 0 12px; font-size: 20px;"><span class="fa fa-github"></span></a>
    <a href="mailto:7david12liu@gmail.com" style="color: #fff; margin: 0 12px; font-size: 20px;"><span class="fa fa-envelope-o"></span></a>
  </div>
  <p style="margin-bottom: 5px;"><a href="../../portfolio.html" style="color: #1abc9c;">Portfolio</a> &middot; <a href="../../index.html" style="color: #1abc9c;">Data</a> &middot; <a href="../../autotrader.html" style="color: #1abc9c;">AutoTrader</a> &middot; <a href="index.html" style="color: #1abc9c;">Daily Updates</a></p>
  <p style="font-size: 12px; margin-bottom: 0;">Dave Liu &copy; 2025</p>
</footer>

<script>
// Auto-resize iframe to fit content
function resizeIframe() {{
  var iframe = document.getElementById('emailFrame');
  try {{
    var height = iframe.contentWindow.document.documentElement.scrollHeight;
    iframe.style.height = height + 40 + 'px';
  }} catch(e) {{
    // Cross-origin fallback: set a generous default
    iframe.style.height = '3000px';
  }}
}}
document.getElementById('emailFrame').addEventListener('load', resizeIframe);
</script>

</body></html>
"""


def parse_existing_entries(index_html):
    """Parse existing entries from index.html between markers.

    Returns dict of date_str -> {'description': str}.
    """
    entries = {}
    start_idx = index_html.find(ENTRY_START)
    end_idx = index_html.find(ENTRY_END)

    if start_idx == -1 or end_idx == -1:
        return entries

    content = index_html[start_idx + len(ENTRY_START) : end_idx]

    # Find all update cards with their dates
    card_pattern = re.compile(
        r'<div class="update-card">\s*'
        r'<a href="(\d{4}-\d{2}-\d{2})\.html">\s*'
        r'<div class="update-date">.*?</div>\s*'
        r'<div class="update-title">.*?</div>\s*'
        r'<p class="update-desc">(.*?)</p>\s*'
        r"</a>\s*"
        r"</div>",
        re.DOTALL,
    )

    for match in card_pattern.finditer(content):
        date_str = match.group(1)
        description = match.group(2).strip()
        entries[date_str] = {"description": description}

    return entries


def generate_card(date_str, date_obj, description):
    """Generate an update card HTML block."""
    date_display = format_date_display(date_obj)
    return (
        f'  <div class="update-card">\n'
        f'    <a href="{date_str}.html">\n'
        f'      <div class="update-date">{date_display}</div>\n'
        f'      <div class="update-title">Daily Market Update</div>\n'
        f'      <p class="update-desc">{description}</p>\n'
        f"    </a>\n"
        f"  </div>"
    )


def generate_entries_html(entries):
    """Generate the full entries HTML from a dict of date_str -> info.

    Groups by month, sorted by date descending.
    """
    if not entries:
        return ""

    sorted_dates = sorted(entries.keys(), reverse=True)

    lines = []
    current_month = None

    for date_str in sorted_dates:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        month_key = (date_obj.year, date_obj.month)

        if month_key != current_month:
            month_header = format_month_header(date_obj)
            lines.append(
                f'\n  <h4 style="margin-top: 30px;">{month_header}</h4>'
            )
            current_month = month_key

        description = entries[date_str].get(
            "description", "Daily market predictions and analysis"
        )
        lines.append("")
        lines.append(generate_card(date_str, date_obj, description))

    return "\n".join(lines)


def update_index(date_str, description):
    """Update index.html with the new/updated entry."""
    with open(INDEX_PATH, "r") as f:
        html = f.read()

    if ENTRY_START not in html or ENTRY_END not in html:
        print(f"ERROR: Markers not found in {INDEX_PATH}")
        print(f"  Expected: {ENTRY_START} and {ENTRY_END}")
        sys.exit(1)

    # Parse existing entries
    entries = parse_existing_entries(html)

    # Add/update the entry
    entries[date_str] = {"description": description}

    # Generate new entries HTML
    entries_html = generate_entries_html(entries)

    # Replace content between markers
    start_idx = html.find(ENTRY_START)
    end_idx = html.find(ENTRY_END)

    new_html = (
        html[: start_idx + len(ENTRY_START)] + entries_html + "\n  " + html[end_idx:]
    )

    with open(INDEX_PATH, "w") as f:
        f.write(new_html)

    print(f"  Updated {INDEX_PATH} ({len(entries)} entries)")


def main():
    args = parse_args()

    # Validate date
    try:
        date_obj = datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        print(f"ERROR: Invalid date format '{args.date}'. Use YYYY-MM-DD.")
        sys.exit(1)

    date_str = args.date

    # Validate source file
    if not os.path.exists(args.source):
        print(f"ERROR: Source file not found: {args.source}")
        sys.exit(1)

    print(f"Publishing daily email for {date_str}")
    print(f"  Source: {args.source}")

    # Ensure emails directory exists
    os.makedirs(EMAILS_DIR, exist_ok=True)

    # 1. Copy source email
    email_dest = os.path.join(EMAILS_DIR, f"{date_str}.html")
    shutil.copy2(args.source, email_dest)
    print(f"  Copied email to {email_dest}")

    # 2. Extract description from email
    with open(email_dest, "r") as f:
        email_html = f.read()
    description = extract_description(email_html)
    print(f"  Description: {description}")

    # 3. Generate wrapper page
    wrapper_path = os.path.join(DAILY_DIR, f"{date_str}.html")
    wrapper_html = generate_wrapper_page(date_str, date_obj)
    with open(wrapper_path, "w") as f:
        f.write(wrapper_html)
    print(f"  Generated wrapper: {wrapper_path}")

    # 4. Update index
    update_index(date_str, description)

    # 5. Git commit and push
    if not args.no_push:
        print("  Committing and pushing...")
        os.chdir(SCRIPT_DIR)
        subprocess.run(["git", "add", "autotrader/daily/"], check=True)

        commit_msg = f"daily: {date_str} market update"
        result = subprocess.run(
            ["git", "diff", "--cached", "--quiet"], capture_output=True
        )
        if result.returncode != 0:  # There are staged changes
            subprocess.run(["git", "commit", "-m", commit_msg], check=True)
            subprocess.run(["git", "pull", "--rebase"], check=True)
            subprocess.run(["git", "push"], check=True)
            print("  Pushed to GitHub!")
        else:
            print("  No changes to commit (already up to date)")
    else:
        print("  Skipping git (--no-push)")

    print(
        f"\nDone! View at: https://daliu.github.io/autotrader/daily/{date_str}.html"
    )


if __name__ == "__main__":
    main()
