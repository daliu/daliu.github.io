#!/usr/bin/env python3
"""Fetch GA4 analytics data and write to analytics/data.json.

Uses the Google Analytics Data API v1.
Requires environment variables:
  GA4_PROPERTY_ID: numeric GA4 property ID
  GA4_CREDENTIALS_JSON: JSON string of service account credentials
"""

import json
import os
from datetime import datetime, timedelta

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

    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    start_date = (datetime.utcnow() - timedelta(days=89)).strftime("%Y-%m-%d")
    date_range = (start_date, end_date)
    date_range_30d = ((datetime.utcnow() - timedelta(days=29)).strftime("%Y-%m-%d"), end_date)

    # 1. Daily overview
    daily_resp = run_report(
        client, property_id,
        dimensions=["date"],
        metrics=["totalUsers", "sessions", "screenPageViews", "newUsers",
                 "averageSessionDuration", "bounceRate"],
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
        })

    # Compute totals
    total_users = sum(d["users"] for d in daily)
    total_sessions = sum(d["sessions"] for d in daily)
    total_pageviews = sum(d["pageviews"] for d in daily)
    avg_duration = (
        sum(d["avg_session_duration"] * d["sessions"] for d in daily) / total_sessions
        if total_sessions > 0 else 0
    )
    avg_bounce = (
        sum(d["bounce_rate"] * d["sessions"] for d in daily) / total_sessions
        if total_sessions > 0 else 0
    )

    # 2. Top pages
    pages_resp = run_report(
        client, property_id,
        dimensions=["pagePath", "pageTitle"],
        metrics=["screenPageViews", "totalUsers", "averageSessionDuration"],
        date_range=date_range,
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="screenPageViews"), desc=True)],
        limit=20,
    )
    pages = []
    for row in pages_resp.rows:
        pages.append({
            "path": row.dimension_values[0].value,
            "title": row.dimension_values[1].value,
            "pageviews": int(row.metric_values[0].value),
            "users": int(row.metric_values[1].value),
            "avg_time_on_page": round(float(row.metric_values[2].value), 1),
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
    sources = parse_rows(sources_resp,
                         ["source", "medium"],
                         ["sessions", "users"])

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
    countries = parse_rows(countries_resp,
                           ["country"],
                           ["sessions", "users"])

    # 7. Hourly (last 30 days)
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
        "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "date_range": {"start": start_date, "end": end_date},
        "totals": {
            "total_users": total_users,
            "total_sessions": total_sessions,
            "total_pageviews": total_pageviews,
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
    print(f"  Total users: {total_users}, pageviews: {total_pageviews}")


if __name__ == "__main__":
    main()
