#!/usr/bin/env python3
"""Fetch GA4 analytics data and write to analytics/data.json.

Uses the Google Analytics Data API v1.
Requires environment variables:
  GA4_PROPERTY_ID: numeric GA4 property ID
  GA4_CREDENTIALS_JSON: JSON string of service account credentials
"""

import json
import os
from datetime import datetime, timedelta, timezone

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    OrderBy,
    RunReportRequest,
)
from google.oauth2 import service_account

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH = os.path.join(REPO_ROOT, "analytics", "data.json")

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]

# Windows (in days) each section is computed over. Surfaced in data.json so the
# dashboard can label exactly what interval every breakdown covers.
MAIN_WINDOW_DAYS = 90
HOURLY_WINDOW_DAYS = 30


def clean_label(value):
    """Make GA4's internal placeholder dimension values human-readable."""
    return {
        "(direct)": "Direct",
        "(none)": "—",
        "(not set)": "Unknown",
        "(not provided)": "Unknown",
        "(data not available)": "Unknown",
    }.get(value, value)


def canonical_path(path):
    """Collapse equivalent URLs so one page isn't counted as several rows.

    e.g. "/index.html" -> "/". Without this the same page can appear multiple
    times in Top Pages whenever its <title> changed during the window.
    """
    if path in ("/index.html", "/index"):
        return "/"
    if path.endswith("/index.html"):
        return path[: -len("index.html")]
    return path


def get_client():
    creds_json = os.environ["GA4_CREDENTIALS_JSON"]
    creds_info = json.loads(creds_json)
    credentials = service_account.Credentials.from_service_account_info(
        creds_info, scopes=SCOPES
    )
    return BetaAnalyticsDataClient(credentials=credentials)


def run_report(client, property_id, dimensions, metrics, date_range, order_bys=None, limit=0):
    request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name=d) for d in dimensions],
        metrics=[Metric(name=m) for m in metrics],
        date_ranges=[DateRange(start_date=date_range[0], end_date=date_range[1])],
        order_bys=order_bys or [],
        limit=limit,
    )
    return client.run_report(request)


def parse_rows(response, dim_names, metric_names):
    rows = []
    for row in response.rows:
        entry = {}
        for i, d in enumerate(dim_names):
            entry[d] = row.dimension_values[i].value
        for i, m in enumerate(metric_names):
            val = row.metric_values[i].value
            entry[m] = float(val) if "." in val else int(val)
        rows.append(entry)
    return rows


def main():
    property_id = os.environ["GA4_PROPERTY_ID"]
    client = get_client()

    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = (datetime.now(timezone.utc) - timedelta(days=MAIN_WINDOW_DAYS - 1)).strftime("%Y-%m-%d")
    date_range = (start_date, end_date)
    date_range_30d = (
        (datetime.now(timezone.utc) - timedelta(days=HOURLY_WINDOW_DAYS - 1)).strftime("%Y-%m-%d"),
        end_date,
    )

    # 1. Daily overview
    daily_resp = run_report(
        client, property_id,
        dimensions=["date"],
        metrics=["totalUsers", "sessions", "screenPageViews", "newUsers",
                 "averageSessionDuration", "bounceRate", "engagedSessions"],
        date_range=date_range,
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="date"))],
    )
    daily = []
    for row in daily_resp.rows:
        d = row.dimension_values[0].value
        daily.append({
            "date": f"{d[:4]}-{d[4:6]}-{d[6:8]}",
            "users": int(row.metric_values[0].value),
            "sessions": int(row.metric_values[1].value),
            "pageviews": int(row.metric_values[2].value),
            "new_users": int(row.metric_values[3].value),
            "avg_session_duration": round(float(row.metric_values[4].value), 1),
            "bounce_rate": round(float(row.metric_values[5].value), 4),
            "engaged_sessions": int(row.metric_values[6].value),
        })

    # Compute totals
    total_users = sum(d["users"] for d in daily)
    total_sessions = sum(d["sessions"] for d in daily)
    total_pageviews = sum(d["pageviews"] for d in daily)
    total_engaged = sum(d["engaged_sessions"] for d in daily)
    engagement_rate = total_engaged / total_sessions if total_sessions > 0 else 0
    avg_duration = (
        sum(d["avg_session_duration"] * d["sessions"] for d in daily) / total_sessions
        if total_sessions > 0 else 0
    )
    avg_bounce = (
        sum(d["bounce_rate"] * d["sessions"] for d in daily) / total_sessions
        if total_sessions > 0 else 0
    )

    # 2. Top pages — aggregate by canonical path.
    #    Querying pagePath alone keeps users/pageviews properly de-duplicated; a
    #    separate title lookup gives a representative title without splitting one
    #    page into multiple rows when its <title> changed during the window.
    pages_resp = run_report(
        client, property_id,
        dimensions=["pagePath"],
        metrics=["screenPageViews", "totalUsers", "averageSessionDuration"],
        date_range=date_range,
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="screenPageViews"), desc=True)],
        limit=50,
    )
    title_resp = run_report(
        client, property_id,
        dimensions=["pagePath", "pageTitle"],
        metrics=["screenPageViews"],
        date_range=date_range,
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="screenPageViews"), desc=True)],
        limit=200,
    )
    # First title seen per path == its highest-traffic title (rows are sorted desc).
    title_map = {}
    for row in title_resp.rows:
        p = canonical_path(row.dimension_values[0].value)
        if p not in title_map:
            title_map[p] = row.dimension_values[1].value

    page_agg = {}
    for row in pages_resp.rows:
        p = canonical_path(row.dimension_values[0].value)
        pv = int(row.metric_values[0].value)
        users = int(row.metric_values[1].value)
        dur = float(row.metric_values[2].value)
        a = page_agg.setdefault(p, {"path": p, "pageviews": 0, "users": 0, "_dur_w": 0.0})
        a["pageviews"] += pv
        a["users"] += users
        a["_dur_w"] += dur * pv
    pages = []
    for a in sorted(page_agg.values(), key=lambda x: x["pageviews"], reverse=True)[:20]:
        pages.append({
            "path": a["path"],
            "title": title_map.get(a["path"], ""),
            "pageviews": a["pageviews"],
            "users": a["users"],
            "avg_time_on_page": round(a["_dur_w"] / a["pageviews"], 1) if a["pageviews"] else 0,
        })

    # 3. Traffic sources
    sources_resp = run_report(
        client, property_id,
        dimensions=["sessionSource", "sessionMedium"],
        metrics=["sessions", "totalUsers"],
        date_range=date_range,
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=15,
    )
    sources = parse_rows(sources_resp, ["source", "medium"], ["sessions", "users"])
    for s in sources:
        s["source"] = clean_label(s["source"])
        s["medium"] = clean_label(s["medium"])

    # 4. Devices
    devices_resp = run_report(
        client, property_id,
        dimensions=["deviceCategory"],
        metrics=["sessions"],
        date_range=date_range,
    )
    device_total = sum(int(r.metric_values[0].value) for r in devices_resp.rows)
    devices = []
    for row in devices_resp.rows:
        s = int(row.metric_values[0].value)
        devices.append({
            "category": row.dimension_values[0].value,
            "sessions": s,
            "percentage": round(s / device_total * 100, 1) if device_total > 0 else 0,
        })

    # 5. Browsers
    browsers_resp = run_report(
        client, property_id,
        dimensions=["browser"],
        metrics=["sessions"],
        date_range=date_range,
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=10,
    )
    browser_total = sum(int(r.metric_values[0].value) for r in browsers_resp.rows)
    browsers = []
    for row in browsers_resp.rows:
        s = int(row.metric_values[0].value)
        browsers.append({
            "browser": row.dimension_values[0].value,
            "sessions": s,
            "percentage": round(s / browser_total * 100, 1) if browser_total > 0 else 0,
        })

    # 6. Countries
    countries_resp = run_report(
        client, property_id,
        dimensions=["country"],
        metrics=["sessions", "totalUsers"],
        date_range=date_range,
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=20,
    )
    countries = parse_rows(countries_resp, ["country"], ["sessions", "users"])
    for c in countries:
        c["country"] = clean_label(c["country"])

    # 7. Hourly (last HOURLY_WINDOW_DAYS days, in the property's reporting timezone)
    hourly_resp = run_report(
        client, property_id,
        dimensions=["hour"],
        metrics=["screenPageViews"],
        date_range=date_range_30d,
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="hour"))],
    )
    hourly_map = {int(row.dimension_values[0].value): int(row.metric_values[0].value)
                  for row in hourly_resp.rows}
    hourly = [{"hour": h, "pageviews": hourly_map.get(h, 0)} for h in range(24)]

    # 8. New vs returning
    nvr_resp = run_report(
        client, property_id,
        dimensions=["newVsReturning"],
        metrics=["sessions"],
        date_range=date_range,
    )
    user_types = {"new": 0, "returning": 0}
    for row in nvr_resp.rows:
        key = row.dimension_values[0].value.lower()
        if key in user_types:
            user_types[key] = int(row.metric_values[0].value)

    # Build output
    output = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "date_range": {"start": start_date, "end": end_date},
        "windows": {
            "main_days": MAIN_WINDOW_DAYS,
            "hourly_days": HOURLY_WINDOW_DAYS,
        },
        "data_span": {
            "start": daily[0]["date"] if daily else start_date,
            "end": daily[-1]["date"] if daily else end_date,
            "days_with_data": len(daily),
        },
        "totals": {
            "total_users": total_users,
            "total_sessions": total_sessions,
            "total_pageviews": total_pageviews,
            "total_engaged_sessions": total_engaged,
            "engagement_rate": round(engagement_rate, 4),
            "avg_session_duration_seconds": round(avg_duration, 1),
            "bounce_rate": round(avg_bounce, 4),
        },
        "daily": daily,
        "pages": pages,
        "sources": sources,
        "devices": devices,
        "browsers": browsers,
        "countries": countries,
        "user_types": user_types,
        "hourly": hourly,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote analytics data to {OUTPUT_PATH}")
    print(f"  Date range: {start_date} to {end_date}")
    print(f"  Daily records: {len(daily)}")
    print(f"  Total users: {total_users}, pageviews: {total_pageviews}, engaged: {total_engaged}")
    print(f"  Top pages: {len(pages)} (deduped by canonical path)")


if __name__ == "__main__":
    main()
