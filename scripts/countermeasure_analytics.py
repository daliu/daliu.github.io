"""Read-only GA4 game reports; never publish individual identifiers or other sites.

Called by the existing daily analytics job. No new schedule or credentials.
"""
import math

GAME_PROPERTY_ID = "530194999"  # Verified stream G-GR5Z815VXW; never inherit another site's property.


def number(value):
    try:
        result = float(value)
        return max(0, result) if math.isfinite(result) else 0
    except (TypeError, ValueError):
        return 0


def snapshot(query, date_range):
    """Query accepts dimensions, metrics and event filter; injected in local tests."""
    totals = query([], ["totalUsers", "eventCount"], "all")
    outcomes = query(["customEvent:cm_mode", "customEvent:cm_difficulty",
                      "customEvent:cm_level", "customEvent:cm_outcome",
                      "customEvent:cm_entry", "customEvent:cm_release"],
                     ["eventCount", "customEvent:cm_seconds", "customEvent:cm_criticals",
                      "customEvent:cm_combos", "customEvent:cm_kills"], "end")
    strategies = query(["customEvent:cm_mode", "customEvent:cm_difficulty",
                        "customEvent:cm_strategy", "customEvent:cm_weapon"],
                       ["eventCount"], "end")
    deaths = query(["customEvent:cm_mode", "customEvent:cm_difficulty",
                    "customEvent:cm_level", "customEvent:cm_death_cell",
                    "customEvent:cm_death_cause"], ["eventCount"], "death")
    controls = query(["customEvent:cm_input"], ["eventCount"], "start")
    limited = any(r["limited"] for r in [totals, outcomes, strategies, deaths, controls])
    quality = any(r.get("thresholded") or r.get("sampled") for r in [totals, outcomes, strategies, deaths, controls])
    t = totals["rows"][0]["metrics"] if totals["rows"] else [0, 0]
    return {"version": 1, "status": "limited" if limited or quality else "ok",
            "date_range": {"start": date_range[0], "end": date_range[1]},
            "unique_browsers": int(number(t[0])), "events": int(number(t[1])),
            "outcomes": outcomes["rows"], "strategies": strategies["rows"],
            "deaths": deaths["rows"], "controls": controls["rows"],
            "limitations": {"row_limit": limited, "thresholded_or_sampled": quality},
            "definition": "GA4 totalUsers for opted-in online cm_ game events; approximate browsers, not people or IPs. QA events excluded."}


def fetch_game_analytics(client, date_range):
    from google.analytics.data_v1beta.types import (
        DateRange, Dimension, Filter, FilterExpression, FilterExpressionList,
        Metric, RunReportRequest,
    )

    def exact(field, value):
        return FilterExpression(filter=Filter(field_name=field, string_filter=Filter.StringFilter(
            match_type=Filter.StringFilter.MatchType.EXACT, value=value)))

    def query(dimensions, metrics, event):
        filters = [exact("hostName", "daliu.github.io"), FilterExpression(
            not_expression=exact("customEvent:cm_entry", "qa"))]
        if event == "all":
            filters.append(FilterExpression(filter=Filter(field_name="eventName", in_list_filter=Filter.InListFilter(
                values=["cm_attempt_start", "cm_attempt_end", "cm_escape"]))))
        else:
            filters.append(exact("eventName", "cm_attempt_start" if event == "start" else "cm_attempt_end"))
            if event == "death":
                filters.append(exact("customEvent:cm_outcome", "death"))
        request = RunReportRequest(property=f"properties/{GAME_PROPERTY_ID}",
            dimensions=[Dimension(name=d) for d in dimensions], metrics=[Metric(name=m) for m in metrics],
            date_ranges=[DateRange(start_date=date_range[0], end_date=date_range[1])],
            dimension_filter=FilterExpression(and_group=FilterExpressionList(expressions=filters)), limit=10000)
        response = client.run_report(request)
        meta = response.metadata
        return {"rows": [{"dimensions": [v.value for v in row.dimension_values],
                          "metrics": [number(v.value) for v in row.metric_values]} for row in response.rows],
                "limited": response.row_count > len(response.rows),
                "thresholded": bool(getattr(meta, "subject_to_thresholding", False)),
                "sampled": bool(getattr(meta, "sampling_metadatas", []))}

    try:
        return snapshot(query, date_range)
    except Exception:
        # Missing definitions/access must not masquerade as zero players, or
        # break the site's independent traffic reports. No provider error text
        # is published (it can include account or request details).
        print("  WARN: Countermeasure report unavailable; check GA4 definitions/access.")
        return {"version": 1, "status": "unavailable", "date_range": {
            "start": date_range[0], "end": date_range[1]}}
