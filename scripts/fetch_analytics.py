#!/usr/bin/env python3
"""Fetch GA4 analytics data and write to analytics/data.json.

Uses the Google Analytics Data API v1.
Requires environment variables:
  GA4_PROPERTY_ID: numeric GA4 property ID
  GA4_CREDENTIALS_JSON: JSON string of service account credentials
"""

import json
import os
import time
import urllib.parse
import urllib.request
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
EVENTS_PATH = os.path.join(REPO_ROOT, "analytics", "events.json")
GEOCODE_CACHE_PATH = os.path.join(SCRIPT_DIR, "geocode_cache.json")

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]

# Windows (in days) each section is computed over. Surfaced in data.json so the
# dashboard can label exactly what interval every breakdown covers.
MAIN_WINDOW_DAYS = 90
HOURLY_WINDOW_DAYS = 30

# Engagement-rate thresholds used to classify a country's traffic quality.
# GA4 "engaged session" = lasted >10s, had a conversion, or had 2+ pageviews.
# A country whose sessions almost never engage is overwhelmingly automated.
QUALITY_HUMAN = 0.40   # >= this -> "human"
QUALITY_MIXED = 0.15   # >= this -> "mixed", else "automated"

# Country centroids — guaranteed fallback so the map always has a point even
# when a city can't be geocoded. Approximate (lat, lng).
COUNTRY_CENTROIDS = {
    "United States": (39.8283, -98.5795),
    "Singapore": (1.3521, 103.8198),
    "China": (35.8617, 104.1954),
    "Canada": (56.1304, -106.3468),
    "France": (46.2276, 2.2137),
    "Hong Kong": (22.3193, 114.1694),
    "Sweden": (60.1282, 18.6435),
    "Trinidad & Tobago": (10.6918, -61.2225),
    "United Kingdom": (55.3781, -3.4360),
    "Germany": (51.1657, 10.4515),
    "India": (20.5937, 78.9629),
    "Japan": (36.2048, 138.2529),
    "Australia": (-25.2744, 133.7751),
    "Netherlands": (52.1326, 5.2913),
    "Brazil": (-14.2350, -51.9253),
    "Ireland": (53.4129, -8.2439),
    "Spain": (40.4637, -3.7492),
    "Italy": (41.8719, 12.5674),
    "South Korea": (35.9078, 127.7669),
    "Taiwan": (23.6978, 120.9605),
    "Vietnam": (14.0583, 108.2772),
    "Indonesia": (-0.7893, 113.9213),
    "Switzerland": (46.8182, 8.2275),
    "Poland": (51.9194, 19.1451),
    "Mexico": (23.6345, -102.5528),
    "Russia": (61.5240, 105.3188),
}


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


def classify_quality(engagement_rate):
    if engagement_rate >= QUALITY_HUMAN:
        return "human"
    if engagement_rate >= QUALITY_MIXED:
        return "mixed"
    return "automated"


def load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception as e:  # corrupt/partial file shouldn't break the run
            print(f"  WARN: could not read {path}: {e}")
    return default


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


# --------------------------------------------------------------------------- #
# Geocoding (for the visitor density map)
# --------------------------------------------------------------------------- #

def _nominatim_lookup(query):
    """Best-effort geocode via OpenStreetMap Nominatim (no API key needed)."""
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1}
    )
    req = urllib.request.Request(
        url, headers={"User-Agent": "daliu-analytics/1.0 (+https://daliu.github.io)"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    if data:
        return [float(data[0]["lat"]), float(data[0]["lon"])]
    return None


def resolve_latlng(city, region, country, cache, budget):
    """Resolve (lat, lng) for a city/country, caching results in `cache`.

    The region (e.g. "California") disambiguates same-named cities — without it
    "Belmont, United States" geocodes to Ohio instead of the Bay Area.

    Order: cache -> live Nominatim lookup (rate-limited, budget-capped) ->
    country centroid. Returns (latlng, is_city) or (None, False).
    """
    city = (city or "").strip()
    region = (region or "").strip()
    if region in ("Unknown", "(not set)"):
        region = ""
    key = f"{city}|{region}|{country}".lower()
    query = ", ".join(p for p in (city, region, country) if p)

    if key in cache:
        cached = cache[key]
        if cached:
            return cached, True
        # cached miss for the city -> fall through to country centroid

    elif city and city not in ("Unknown", "(not set)") and budget["n"] > 0:
        result = None
        try:
            result = _nominatim_lookup(query)
        except Exception as e:
            print(f"  WARN: geocode failed for {query}: {e}")
        budget["n"] -= 1
        time.sleep(1.1)  # Nominatim courtesy rate limit (<=1 req/sec)
        cache[key] = result
        if result:
            return result, True

    centroid = COUNTRY_CENTROIDS.get(country)
    if centroid:
        return list(centroid), False
    return None, False


# --------------------------------------------------------------------------- #
# Trends + event impact (computed locally from the daily series)
# --------------------------------------------------------------------------- #

def compute_trends(daily):
    """Week-over-week / month-over-month deltas and page-view anomalies."""
    trends = {}

    def wsum(rows, key):
        return sum(r[key] for r in rows)

    def delta_block(cur_rows, prev_rows):
        block = {}
        for key in ("users", "sessions", "pageviews"):
            cur, prev = wsum(cur_rows, key), wsum(prev_rows, key)
            block[key] = {
                "current": cur,
                "previous": prev,
                "change_pct": round((cur - prev) / prev * 100, 1) if prev else None,
            }
        return block

    n = len(daily)
    if n >= 14:
        trends["wow"] = delta_block(daily[-7:], daily[-14:-7])
    if n >= 60:
        trends["mom"] = delta_block(daily[-30:], daily[-60:-30])

    pv = [d["pageviews"] for d in daily]
    if len(pv) >= 7:
        mean = sum(pv) / len(pv)
        std = (sum((x - mean) ** 2 for x in pv) / len(pv)) ** 0.5
        anomalies = []
        if std > 0:
            for d in daily:
                z = (d["pageviews"] - mean) / std
                if z >= 2:
                    anomalies.append({
                        "date": d["date"],
                        "pageviews": d["pageviews"],
                        "z": round(z, 1),
                    })
        trends["baseline"] = {
            "mean_pageviews": round(mean, 1),
            "std_pageviews": round(std, 1),
        }
        trends["anomalies"] = anomalies
    return trends


def compute_event_impact(daily, events_input):
    """For each known event, compare avg page views before vs. after.

    Correlational only — a known change on the site, not proof of cause.
    Baseline = mean pageviews in the 7 days before; after = mean in the
    3 days from the event (inclusive).
    """
    dates = [d["date"] for d in daily]
    by_date = {d["date"]: d for d in daily}
    out = []
    for ev in events_input:
        d = ev.get("date")
        entry = {
            "date": d,
            "label": ev.get("label", ""),
            "url": ev.get("url", ""),
        }
        if d not in by_date:
            entry["note"] = "no traffic data on this date"
            entry["baseline_pageviews"] = None
            entry["after_pageviews"] = None
            entry["lift_pct"] = None
            out.append(entry)
            continue
        idx = dates.index(d)
        pre = [by_date[dates[i]]["pageviews"] for i in range(max(0, idx - 7), idx)]
        post = [by_date[dates[i]]["pageviews"] for i in range(idx, min(len(dates), idx + 3))]
        base = sum(pre) / len(pre) if pre else 0
        aft = sum(post) / len(post) if post else 0
        entry["baseline_pageviews"] = round(base, 1)
        entry["after_pageviews"] = round(aft, 1)
        entry["lift_pct"] = round((aft - base) / base * 100, 1) if base else None
        out.append(entry)
    return out


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

    # ----------------------------------------------------------------------- #
    # 9. Traffic quality by country (real-audience filtering)
    #    Each new section below is wrapped so a single failing report can't
    #    take down the whole pipeline — the dashboard guards on missing keys.
    # ----------------------------------------------------------------------- #
    country_quality = []
    quality = {}
    try:
        cq_resp = run_report(
            client, property_id,
            dimensions=["country"],
            metrics=["sessions", "engagedSessions", "totalUsers",
                     "screenPageViews", "averageSessionDuration"],
            date_range=date_range,
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
            limit=50,
        )
        for row in cq_resp.rows:
            country = clean_label(row.dimension_values[0].value)
            sess = int(row.metric_values[0].value)
            eng = int(row.metric_values[1].value)
            usrs = int(row.metric_values[2].value)
            pv = int(row.metric_values[3].value)
            dur = round(float(row.metric_values[4].value), 1)
            rate = eng / sess if sess else 0
            country_quality.append({
                "country": country,
                "sessions": sess,
                "engaged": eng,
                "users": usrs,
                "pageviews": pv,
                "avg_duration": dur,
                "engagement_rate": round(rate, 3),
                "class": classify_quality(rate),
            })
        cq_total = sum(c["sessions"] for c in country_quality)
        auto_sess = sum(c["sessions"] for c in country_quality if c["class"] == "automated")
        human_users = sum(c["users"] for c in country_quality if c["class"] != "automated")
        quality = {
            "engaged_sessions": total_engaged,
            "non_engaged_sessions": max(total_sessions - total_engaged, 0),
            "likely_automated_sessions": auto_sess,
            "likely_human_sessions": max(cq_total - auto_sess, 0),
            "automated_pct": round(auto_sess / cq_total * 100, 1) if cq_total else 0,
            "est_human_users": human_users,
            "thresholds": {"human": QUALITY_HUMAN, "mixed": QUALITY_MIXED},
        }
    except Exception as e:
        print(f"  WARN: traffic-quality section failed: {e}")

    # ----------------------------------------------------------------------- #
    # 10. Activity heatmaps: day-of-week x hour, and hour x country (site time)
    # ----------------------------------------------------------------------- #
    punchcard = {}
    try:
        pc_resp = run_report(
            client, property_id,
            dimensions=["dayOfWeek", "hour"],
            metrics=["screenPageViews"],
            date_range=date_range,
        )
        # GA4 dayOfWeek: "0"=Sunday .. "6"=Saturday
        matrix = [[0] * 24 for _ in range(7)]
        for row in pc_resp.rows:
            dow = int(row.dimension_values[0].value)
            hr = int(row.dimension_values[1].value)
            if 0 <= dow < 7 and 0 <= hr < 24:
                matrix[dow][hr] = int(row.metric_values[0].value)
        punchcard = {
            "dow_labels": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            "matrix": matrix,
            "metric": "pageviews",
        }
    except Exception as e:
        print(f"  WARN: punchcard section failed: {e}")

    hour_by_country = {}
    try:
        top_countries = [c["country"] for c in country_quality[:5]
                         if c["country"] != "Unknown"]
        if not top_countries:  # fall back to the plain country list
            top_countries = [c["country"] for c in countries[:5]
                             if c["country"] != "Unknown"]
        hc_resp = run_report(
            client, property_id,
            dimensions=["country", "hour"],
            metrics=["sessions"],
            date_range=date_range,
            limit=2000,
        )
        hc_map = {c: [0] * 24 for c in top_countries}
        for row in hc_resp.rows:
            c = clean_label(row.dimension_values[0].value)
            hr = int(row.dimension_values[1].value)
            if c in hc_map and 0 <= hr < 24:
                hc_map[c][hr] = int(row.metric_values[0].value)
        hour_by_country = {
            "countries": top_countries,
            "matrix": [hc_map[c] for c in top_countries],
            "metric": "sessions",
        }
    except Exception as e:
        print(f"  WARN: hour-by-country section failed: {e}")

    # ----------------------------------------------------------------------- #
    # 11. Geographic density map points (city/country -> lat/lng, cached)
    # ----------------------------------------------------------------------- #
    geo_points = []
    try:
        geo_resp = run_report(
            client, property_id,
            dimensions=["country", "region", "city"],
            metrics=["sessions", "totalUsers", "engagedSessions"],
            date_range=date_range,
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
            limit=100,
        )
        geo_cache = load_json(GEOCODE_CACHE_PATH, {})
        budget = {"n": 25}  # cap live lookups per run; cache makes steady-state ~0
        points = {}
        for row in geo_resp.rows:
            country = clean_label(row.dimension_values[0].value)
            region = clean_label(row.dimension_values[1].value)
            city = clean_label(row.dimension_values[2].value)
            sess = int(row.metric_values[0].value)
            usrs = int(row.metric_values[1].value)
            eng = int(row.metric_values[2].value)
            if country == "Unknown":
                continue
            latlng, is_city = resolve_latlng(
                city if city != "Unknown" else "", region, country, geo_cache, budget
            )
            if not latlng:
                continue
            label = f"{city}, {country}" if (is_city and city != "Unknown") else country
            k = (round(latlng[0], 3), round(latlng[1], 3))
            p = points.setdefault(k, {
                "lat": latlng[0], "lng": latlng[1], "label": label,
                "sessions": 0, "users": 0, "engaged": 0,
            })
            p["sessions"] += sess
            p["users"] += usrs
            p["engaged"] += eng
        geo_points = sorted(points.values(), key=lambda x: x["sessions"], reverse=True)
        for p in geo_points:
            p["engagement_rate"] = round(p["engaged"] / p["sessions"], 3) if p["sessions"] else 0
        # Persist newly-geocoded cities so future runs need no network.
        try:
            with open(GEOCODE_CACHE_PATH, "w") as f:
                json.dump(geo_cache, f, indent=2, sort_keys=True)
        except Exception as e:
            print(f"  WARN: could not write geocode cache: {e}")
    except Exception as e:
        print(f"  WARN: geo-points section failed: {e}")

    # ----------------------------------------------------------------------- #
    # 12. Trends + event impact (computed locally from the daily series)
    # ----------------------------------------------------------------------- #
    trends = compute_trends(daily)
    events_input = load_json(EVENTS_PATH, {}).get("events", [])
    events = compute_event_impact(daily, events_input)

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
        "quality": quality,
        "country_quality": country_quality,
        "punchcard": punchcard,
        "hour_by_country": hour_by_country,
        "geo_points": geo_points,
        "trends": trends,
        "events": events,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote analytics data to {OUTPUT_PATH}")
    print(f"  Date range: {start_date} to {end_date}")
    print(f"  Daily records: {len(daily)}")
    print(f"  Total users: {total_users}, pageviews: {total_pageviews}, engaged: {total_engaged}")
    print(f"  Top pages: {len(pages)} (deduped by canonical path)")
    if quality:
        print(f"  Quality: ~{quality['automated_pct']}% sessions likely automated; "
              f"est. {quality['est_human_users']} human users")
    print(f"  Geo points: {len(geo_points)}; anomalies: {len(trends.get('anomalies', []))}; "
          f"events: {len(events)}")


if __name__ == "__main__":
    main()
