"""Synthetic report tests. No credentials or Google requests."""
import importlib.util
import pathlib
import sys
import types
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "countermeasure_analytics.py"
spec = importlib.util.spec_from_file_location("game_reports", PATH)
reports = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reports)


class Request:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class Filter(Request):
    class StringFilter(Request):
        MatchType = types.SimpleNamespace(EXACT="EXACT")
    InListFilter = Request


class ReportsTest(unittest.TestCase):
    def test_unique_browsers_are_queried_once_not_summed_over_days_or_outcomes(self):
        calls = []
        def query(dims, metrics, event):
            calls.append((dims, metrics, event))
            return {"rows": [{"dimensions": [], "metrics": [7, 42]}] if event == "all" else [], "limited": False}
        result = reports.snapshot(query, ("2026-10-01", "2026-10-25"))
        self.assertEqual(result["unique_browsers"], 7)
        self.assertEqual(result["events"], 42)
        self.assertEqual(len([c for c in calls if c[2] == "all"]), 1)
        self.assertEqual(result["status"], "ok")

    def test_truncation_and_quality_limits_are_visible(self):
        result = reports.snapshot(lambda *args: {"rows": [], "limited": True, "thresholded": True}, ("a", "b"))
        self.assertEqual(result["status"], "limited")
        self.assertTrue(result["limitations"]["row_limit"])
        self.assertTrue(result["limitations"]["thresholded_or_sampled"])

    def test_requests_are_scoped_to_game_hostname_and_events_and_exclude_qa(self):
        requests = []
        def run_report(request):
            requests.append(request)
            return types.SimpleNamespace(rows=[], row_count=0, metadata=types.SimpleNamespace())
        client = types.SimpleNamespace(run_report=run_report)
        fake = types.ModuleType("google.analytics.data_v1beta.types")
        for name in ["DateRange", "Dimension", "FilterExpression", "FilterExpressionList", "Metric", "RunReportRequest"]:
            setattr(fake, name, Request)
        fake.Filter = Filter
        with patch.dict(sys.modules, {"google.analytics.data_v1beta.types": fake}):
            result = reports.fetch_game_analytics(client, ("2026-10-01", "2026-10-25"))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(requests), 5)
        for request in requests:
            self.assertEqual(request.property, "properties/530194999")
            expr = request.dimension_filter.and_group.expressions
            self.assertEqual(expr[0].filter.field_name, "hostName")
            self.assertEqual(expr[0].filter.string_filter.value, "daliu.github.io")
            self.assertEqual(expr[1].not_expression.filter.field_name, "customEvent:cm_entry")
            self.assertEqual(expr[1].not_expression.filter.string_filter.value, "qa")
            self.assertEqual(expr[2].filter.field_name, "eventName")
            self.assertLessEqual(len(request.dimensions), 9)
            self.assertEqual(request.limit, 10000)

    def test_reporting_failure_is_unavailable_not_zero_or_provider_error_details(self):
        fake = types.ModuleType("google.analytics.data_v1beta.types")
        for name in ["DateRange", "Dimension", "FilterExpression", "FilterExpressionList", "Metric", "RunReportRequest"]:
            setattr(fake, name, Request)
        fake.Filter = Filter
        client = types.SimpleNamespace(run_report=lambda r: (_ for _ in ()).throw(RuntimeError("private provider detail")))
        with patch.dict(sys.modules, {"google.analytics.data_v1beta.types": fake}):
            result = reports.fetch_game_analytics(client, ("a", "b"))
        self.assertEqual(result["status"], "unavailable")
        self.assertNotIn("unique_browsers", result)
        self.assertNotIn("private", str(result))

    def test_nonfinite_and_negative_metrics_cannot_pollute_the_snapshot(self):
        for value in ["nan", "inf", -1, None, "private"]:
            self.assertEqual(reports.number(value), 0)


if __name__ == "__main__":
    unittest.main()
