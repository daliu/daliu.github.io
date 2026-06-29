"""Tests for publish_daily.py — the critical daily email publishing pipeline.

Covers: is_trading_day, update_index, _batch_update_index, generate_wrapper_page,
        generate_placeholder_wrapper_page, git_commit_and_push, parse_args,
        extract_description, format_date_display, find_trading_day_gaps,
        find_gaps_since_last_entry, parse_existing_entries, generate_card,
        generate_entries_html, update_sitemap.
"""

import os
import sys
from datetime import datetime
from unittest.mock import MagicMock, call, patch

import pytest

# Ensure the repo root is on sys.path so we can import publish_daily
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import publish_daily


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_index_html(entries_block=""):
    """Return minimal index HTML with the marker comments."""
    return (
        f"<html><body>\n"
        f"{publish_daily.ENTRY_START}\n"
        f"{entries_block}"
        f"{publish_daily.ENTRY_END}\n"
        f"</body></html>"
    )


def _make_card_html(date_str, description="Daily market predictions and analysis"):
    """Generate an entry card matching the format produced by generate_card."""
    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    return publish_daily.generate_card(date_str, date_obj, description)


# ---------------------------------------------------------------------------
# is_trading_day
# ---------------------------------------------------------------------------

class TestIsTradingDay:
    """Tests for is_trading_day(date_obj)."""

    def test_weekday_returns_true(self):
        # 2026-03-02 is a Monday, not a holiday
        assert publish_daily.is_trading_day(datetime(2026, 3, 2)) is True

    def test_saturday_returns_false(self):
        assert publish_daily.is_trading_day(datetime(2026, 3, 7)) is False

    def test_sunday_returns_false(self):
        assert publish_daily.is_trading_day(datetime(2026, 3, 8)) is False

    def test_nyse_holiday_returns_false(self):
        # Christmas 2026 is a Friday
        assert publish_daily.is_trading_day(datetime(2026, 12, 25)) is False

    def test_new_years_day_returns_false(self):
        assert publish_daily.is_trading_day(datetime(2026, 1, 1)) is False

    def test_mlk_day_returns_false(self):
        assert publish_daily.is_trading_day(datetime(2026, 1, 19)) is False

    def test_day_after_holiday_is_trading_day(self):
        # Day after MLK Day 2026 (Jan 20) is a Tuesday
        assert publish_daily.is_trading_day(datetime(2026, 1, 20)) is True

    def test_good_friday_returns_false(self):
        assert publish_daily.is_trading_day(datetime(2026, 4, 3)) is False

    def test_regular_friday(self):
        # 2026-03-06 is a normal Friday
        assert publish_daily.is_trading_day(datetime(2026, 3, 6)) is True


# ---------------------------------------------------------------------------
# format_date_display & format_month_header
# ---------------------------------------------------------------------------

class TestFormatHelpers:
    def test_format_date_display(self):
        dt = datetime(2026, 2, 18)
        result = publish_daily.format_date_display(dt)
        assert "February 18, 2026" in result
        assert "Wednesday" in result
        assert "&middot;" in result

    def test_format_month_header(self):
        dt = datetime(2026, 2, 1)
        assert publish_daily.format_month_header(dt) == "February 2026"


# ---------------------------------------------------------------------------
# extract_description
# ---------------------------------------------------------------------------

class TestExtractDescription:
    def test_extracts_ticker_count(self):
        html = "<p>Total Tickers: 630</p>"
        result = publish_daily.extract_description(html)
        assert "630 tickers analyzed" in result

    def test_extracts_stock_market_sentiment(self):
        html = "<div>Stock Market: 40/100 - FEAR</div>"
        result = publish_daily.extract_description(html)
        assert "Fear" in result
        assert "40/100" in result

    def test_extracts_crypto_sentiment(self):
        html = "<span>Crypto Market: 9/100 - EXTREME FEAR</span>"
        result = publish_daily.extract_description(html)
        assert "Crypto" in result
        assert "9/100" in result

    def test_extracts_congress_trades(self):
        html = "<p>50 trades in last 14 days</p>"
        result = publish_daily.extract_description(html)
        assert "50 congress trades tracked" in result

    def test_default_description_when_no_matches(self):
        html = "<p>Nothing useful here</p>"
        result = publish_daily.extract_description(html)
        assert result == "Daily market predictions and analysis"

    def test_multiple_stats_joined(self):
        html = (
            "<p>Total Tickers: 500</p>"
            "<p>Stock Market: 60/100 - GREED</p>"
            "<p>20 trades in last 7 days</p>"
        )
        result = publish_daily.extract_description(html)
        assert "&middot;" in result
        assert "500 tickers analyzed" in result
        assert "Greed" in result
        assert "20 congress trades tracked" in result


# ---------------------------------------------------------------------------
# parse_existing_entries
# ---------------------------------------------------------------------------

class TestParseExistingEntries:
    def test_empty_markers(self):
        html = _make_index_html("")
        entries = publish_daily.parse_existing_entries(html)
        assert entries == {}

    def test_no_markers(self):
        html = "<html><body>no markers</body></html>"
        entries = publish_daily.parse_existing_entries(html)
        assert entries == {}

    def test_single_entry(self):
        card = _make_card_html("2026-03-02", "Test description")
        html = _make_index_html(card + "\n")
        entries = publish_daily.parse_existing_entries(html)
        assert "2026-03-02" in entries
        assert entries["2026-03-02"]["description"] == "Test description"

    def test_multiple_entries(self):
        cards = "\n".join([
            _make_card_html("2026-03-02", "Desc A"),
            _make_card_html("2026-03-03", "Desc B"),
        ])
        html = _make_index_html(cards + "\n")
        entries = publish_daily.parse_existing_entries(html)
        assert len(entries) == 2
        assert "2026-03-02" in entries
        assert "2026-03-03" in entries


# ---------------------------------------------------------------------------
# update_index
# ---------------------------------------------------------------------------

class TestUpdateIndex:
    """Tests for update_index(date_str, description)."""

    def test_creates_new_index_on_file_not_found(self, tmp_path, monkeypatch):
        # Point INDEX_PATH to a non-existent file in tmp_path
        index_path = str(tmp_path / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        publish_daily.update_index("2026-03-02", "Test daily update")

        assert os.path.exists(index_path)
        with open(index_path) as f:
            content = f.read()
        assert "2026-03-02" in content
        assert "Test daily update" in content
        assert publish_daily.ENTRY_START in content
        assert publish_daily.ENTRY_END in content

    def test_updates_existing_index(self, tmp_path, monkeypatch):
        index_path = str(tmp_path / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        # Create initial index with one entry
        with open(index_path, "w") as f:
            f.write(_make_index_html(""))

        publish_daily.update_index("2026-03-02", "First entry")

        with open(index_path) as f:
            content = f.read()
        assert "2026-03-02" in content
        assert "First entry" in content

    def test_adds_second_entry(self, tmp_path, monkeypatch):
        index_path = str(tmp_path / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        with open(index_path, "w") as f:
            f.write(_make_index_html(""))

        publish_daily.update_index("2026-03-02", "Entry one")
        publish_daily.update_index("2026-03-03", "Entry two")

        with open(index_path) as f:
            content = f.read()
        assert "2026-03-02" in content
        assert "2026-03-03" in content
        assert "Entry one" in content
        assert "Entry two" in content

    def test_deduplicates_existing_entry(self, tmp_path, monkeypatch):
        index_path = str(tmp_path / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        with open(index_path, "w") as f:
            f.write(_make_index_html(""))

        publish_daily.update_index("2026-03-02", "Old description")
        publish_daily.update_index("2026-03-02", "Updated description")

        with open(index_path) as f:
            content = f.read()
        # Should have only one occurrence of the date link
        assert content.count('href="2026-03-02.html"') == 1
        assert "Updated description" in content
        # Old description should be gone
        assert "Old description" not in content

    def test_exits_when_markers_missing(self, tmp_path, monkeypatch):
        index_path = str(tmp_path / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        with open(index_path, "w") as f:
            f.write("<html>no markers here</html>")

        with pytest.raises(SystemExit):
            publish_daily.update_index("2026-03-02", "Should fail")


# ---------------------------------------------------------------------------
# _batch_update_index
# ---------------------------------------------------------------------------

class TestBatchUpdateIndex:
    """Tests for _batch_update_index(new_entries)."""

    def test_multiple_entries_single_write(self, tmp_path, monkeypatch):
        index_path = str(tmp_path / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        with open(index_path, "w") as f:
            f.write(_make_index_html(""))

        new_entries = {
            "2026-03-02": "Entry A",
            "2026-03-03": "Entry B",
            "2026-03-04": "Entry C",
        }
        publish_daily._batch_update_index(new_entries)

        with open(index_path) as f:
            content = f.read()
        assert "2026-03-02" in content
        assert "2026-03-03" in content
        assert "2026-03-04" in content

    def test_deduplicates_existing_entries(self, tmp_path, monkeypatch):
        index_path = str(tmp_path / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        # Seed index with one existing entry
        with open(index_path, "w") as f:
            f.write(_make_index_html(""))
        publish_daily.update_index("2026-03-02", "Old desc")

        # Batch update that includes 2026-03-02 again plus a new one
        publish_daily._batch_update_index({
            "2026-03-02": "New desc for Mar 2",
            "2026-03-05": "New entry",
        })

        with open(index_path) as f:
            content = f.read()
        assert content.count('href="2026-03-02.html"') == 1
        assert "New desc for Mar 2" in content
        assert "2026-03-05" in content

    def test_creates_index_if_missing(self, tmp_path, monkeypatch):
        index_path = str(tmp_path / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        publish_daily._batch_update_index({"2026-03-02": "Created"})

        assert os.path.exists(index_path)
        with open(index_path) as f:
            content = f.read()
        assert "2026-03-02" in content


# ---------------------------------------------------------------------------
# generate_wrapper_page
# ---------------------------------------------------------------------------

class TestGenerateWrapperPage:
    """Tests for generate_wrapper_page(date_str, date_obj)."""

    def setup_method(self):
        self.date_str = "2026-02-18"
        self.date_obj = datetime(2026, 2, 18)
        self.html = publish_daily.generate_wrapper_page(self.date_str, self.date_obj)

    def test_valid_html(self):
        assert self.html.startswith("<!DOCTYPE html>")
        assert "</html>" in self.html

    def test_correct_date_in_heading(self):
        assert "February 18, 2026" in self.html

    def test_nav_links_hidden_by_default(self):
        assert 'id="prev-day"' in self.html
        assert 'id="next-day"' in self.html
        assert 'display: none;' in self.html

    def test_ga4_snippet_present(self):
        assert "G-GR5Z815VXW" in self.html
        assert "googletagmanager.com/gtag" in self.html

    def test_og_tags_present(self):
        assert 'property="og:title"' in self.html
        assert 'property="og:description"' in self.html
        assert 'property="og:type" content="article"' in self.html
        assert 'property="og:url"' in self.html
        assert 'property="og:image"' in self.html

    def test_canonical_url_correct(self):
        assert (
            f'href="https://daliu.github.io/autotrader/daily/{self.date_str}.html"'
            in self.html
        )

    def test_iframe_source_correct(self):
        assert f'src="emails/{self.date_str}.html"' in self.html

    def test_title_contains_date(self):
        assert "Feb 18, 2026" in self.html

    def test_twitter_card_present(self):
        assert 'name="twitter:card"' in self.html

    def test_favicon_present(self):
        assert 'favicon.svg' in self.html


# ---------------------------------------------------------------------------
# generate_placeholder_wrapper_page
# ---------------------------------------------------------------------------

class TestGeneratePlaceholderWrapperPage:
    """Tests for generate_placeholder_wrapper_page(date_str, date_obj)."""

    def setup_method(self):
        self.date_str = "2026-03-10"
        self.date_obj = datetime(2026, 3, 10)
        self.html = publish_daily.generate_placeholder_wrapper_page(
            self.date_str, self.date_obj
        )

    def test_valid_html(self):
        assert self.html.startswith("<!DOCTYPE html>")
        assert "</html>" in self.html

    def test_placeholder_message_present(self):
        assert publish_daily.PLACEHOLDER_MESSAGE in self.html

    def test_no_iframe(self):
        assert "<iframe" not in self.html

    def test_ga4_snippet_present(self):
        assert "G-GR5Z815VXW" in self.html

    def test_og_tags_present(self):
        assert 'property="og:title"' in self.html
        assert 'property="og:url"' in self.html

    def test_canonical_url_correct(self):
        assert (
            f'href="https://daliu.github.io/autotrader/daily/{self.date_str}.html"'
            in self.html
        )

    def test_nav_links_hidden_by_default(self):
        assert 'display: none;' in self.html

    def test_placeholder_css_class(self):
        assert "placeholder-message" in self.html

    def test_date_in_heading(self):
        assert "March 10, 2026" in self.html


# ---------------------------------------------------------------------------
# git_commit_and_push
# ---------------------------------------------------------------------------

class TestGitCommitAndPush:
    """Tests for git_commit_and_push(commit_msg) with mocked subprocess."""

    @patch("publish_daily.subprocess.run")
    @patch("publish_daily.os.chdir")
    def test_stash_popped_in_finally_on_success(self, mock_chdir, mock_run):
        """Stash pop must happen even when the push succeeds."""
        def side_effect(cmd, **kwargs):
            result = MagicMock()
            if cmd == ["git", "diff", "--cached", "--quiet"]:
                result.returncode = 1  # There are staged changes
            elif cmd == ["git", "stash"]:
                result.stdout = "Saved working directory"
                result.returncode = 0
            elif cmd == ["git", "pull", "--rebase"]:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            else:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            return result

        mock_run.side_effect = side_effect
        publish_daily.git_commit_and_push("test commit")

        # Verify stash pop was called
        stash_pop_calls = [
            c for c in mock_run.call_args_list
            if c[0][0] == ["git", "stash", "pop"]
        ]
        assert len(stash_pop_calls) == 1

    @patch("publish_daily.subprocess.run")
    @patch("publish_daily.os.chdir")
    def test_stash_popped_in_finally_on_rebase_failure(self, mock_chdir, mock_run):
        """Stash pop must happen even when rebase fails and merge is attempted."""
        call_log = []

        def side_effect(cmd, **kwargs):
            call_log.append(cmd)
            result = MagicMock()
            if cmd == ["git", "diff", "--cached", "--quiet"]:
                result.returncode = 1
            elif cmd == ["git", "stash"]:
                result.stdout = "Saved working directory"
                result.returncode = 0
            elif cmd == ["git", "pull", "--rebase"]:
                result.returncode = 1
                result.stderr = "CONFLICT"
                result.stdout = ""
            elif cmd == ["git", "pull", "--no-rebase"]:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            else:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            return result

        mock_run.side_effect = side_effect
        publish_daily.git_commit_and_push("test commit")

        stash_pop_calls = [c for c in call_log if c == ["git", "stash", "pop"]]
        assert len(stash_pop_calls) == 1

    @patch("publish_daily.subprocess.run")
    @patch("publish_daily.os.chdir")
    def test_stash_popped_on_push_exception(self, mock_chdir, mock_run):
        """Stash pop must happen even when push raises an exception."""
        def side_effect(cmd, **kwargs):
            result = MagicMock()
            if cmd == ["git", "diff", "--cached", "--quiet"]:
                result.returncode = 1
            elif cmd == ["git", "stash"]:
                result.stdout = "Saved working directory"
                result.returncode = 0
            elif cmd == ["git", "pull", "--rebase"]:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            elif cmd == ["git", "push"]:
                raise RuntimeError("push failed")
            elif cmd == ["git", "stash", "pop"]:
                result.returncode = 0
            else:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            return result

        mock_run.side_effect = side_effect

        with pytest.raises(RuntimeError, match="push failed"):
            publish_daily.git_commit_and_push("test commit")

        stash_pop_calls = [
            c for c in mock_run.call_args_list
            if c[0][0] == ["git", "stash", "pop"]
        ]
        assert len(stash_pop_calls) == 1

    @patch("publish_daily.subprocess.run")
    @patch("publish_daily.os.chdir")
    def test_no_commit_when_no_changes(self, mock_chdir, mock_run):
        """When there are no staged changes, skip commit entirely."""
        def side_effect(cmd, **kwargs):
            result = MagicMock()
            if cmd == ["git", "diff", "--cached", "--quiet"]:
                result.returncode = 0  # No staged changes
            else:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            return result

        mock_run.side_effect = side_effect
        publish_daily.git_commit_and_push("test commit")

        # Verify commit was never called
        commit_calls = [
            c for c in mock_run.call_args_list
            if len(c[0]) > 0 and c[0][0][:2] == ["git", "commit"]
        ]
        assert len(commit_calls) == 0

    @patch("publish_daily.subprocess.run")
    @patch("publish_daily.os.chdir")
    def test_stash_not_popped_when_nothing_stashed(self, mock_chdir, mock_run):
        """When git stash reports no local changes, don't pop."""
        def side_effect(cmd, **kwargs):
            result = MagicMock()
            if cmd == ["git", "diff", "--cached", "--quiet"]:
                result.returncode = 1
            elif cmd == ["git", "stash"]:
                result.stdout = "No local changes to save"
                result.returncode = 0
            elif cmd == ["git", "pull", "--rebase"]:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            else:
                result.returncode = 0
                result.stdout = ""
                result.stderr = ""
            return result

        mock_run.side_effect = side_effect
        publish_daily.git_commit_and_push("test commit")

        stash_pop_calls = [
            c for c in mock_run.call_args_list
            if c[0][0] == ["git", "stash", "pop"]
        ]
        assert len(stash_pop_calls) == 0


# ---------------------------------------------------------------------------
# parse_args
# ---------------------------------------------------------------------------

class TestParseArgs:
    """Tests for parse_args() with sys.argv patching."""

    def test_default_args(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["publish_daily.py"])
        args = publish_daily.parse_args()
        assert args.no_push is False
        assert args.placeholder is False
        assert args.backfill_gaps is False
        assert args.regenerate_wrappers is False
        # Default date should be today-ish (just check format)
        assert len(args.date) == 10 and args.date[4] == "-"

    def test_date_flag(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["publish_daily.py", "--date", "2026-02-18"])
        args = publish_daily.parse_args()
        assert args.date == "2026-02-18"

    def test_no_push_flag(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["publish_daily.py", "--no-push"])
        args = publish_daily.parse_args()
        assert args.no_push is True

    def test_placeholder_flag(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["publish_daily.py", "--placeholder"])
        args = publish_daily.parse_args()
        assert args.placeholder is True

    def test_backfill_gaps_flag(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["publish_daily.py", "--backfill-gaps"])
        args = publish_daily.parse_args()
        assert args.backfill_gaps is True

    def test_regenerate_wrappers_flag(self, monkeypatch):
        monkeypatch.setattr(
            sys, "argv", ["publish_daily.py", "--regenerate-wrappers"]
        )
        args = publish_daily.parse_args()
        assert args.regenerate_wrappers is True

    def test_combined_flags(self, monkeypatch):
        monkeypatch.setattr(
            sys,
            "argv",
            ["publish_daily.py", "--date", "2026-01-15", "--no-push", "--placeholder"],
        )
        args = publish_daily.parse_args()
        assert args.date == "2026-01-15"
        assert args.no_push is True
        assert args.placeholder is True

    def test_source_flag(self, monkeypatch):
        monkeypatch.setattr(
            sys,
            "argv",
            ["publish_daily.py", "--source", "/tmp/my_email.html"],
        )
        args = publish_daily.parse_args()
        assert args.source == "/tmp/my_email.html"


# ---------------------------------------------------------------------------
# find_trading_day_gaps
# ---------------------------------------------------------------------------

class TestFindTradingDayGaps:
    def test_no_gaps_consecutive_days(self):
        # Mon-Fri week with no gaps
        dates = {"2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"}
        gaps = publish_daily.find_trading_day_gaps(dates)
        assert gaps == []

    def test_finds_midweek_gap(self):
        # Missing Wednesday 2026-03-04
        dates = {"2026-03-02", "2026-03-03", "2026-03-05", "2026-03-06"}
        gaps = publish_daily.find_trading_day_gaps(dates)
        assert "2026-03-04" in gaps

    def test_skips_weekends(self):
        # Friday to Monday — no gap (weekend is not a trading day)
        dates = {"2026-03-06", "2026-03-09"}
        gaps = publish_daily.find_trading_day_gaps(dates)
        assert gaps == []

    def test_skips_holidays(self):
        # Days around MLK Day 2026 (Jan 19 is Monday holiday)
        # Jan 16 (Fri) and Jan 20 (Tue) — no gap because Jan 19 is a holiday
        dates = {"2026-01-16", "2026-01-20"}
        gaps = publish_daily.find_trading_day_gaps(dates)
        assert "2026-01-19" not in gaps

    def test_fewer_than_two_entries_returns_empty(self):
        assert publish_daily.find_trading_day_gaps({"2026-03-02"}) == []
        assert publish_daily.find_trading_day_gaps(set()) == []


# ---------------------------------------------------------------------------
# find_gaps_since_last_entry
# ---------------------------------------------------------------------------

class TestFindGapsSinceLastEntry:
    def test_no_gaps_next_trading_day(self):
        existing = {"2026-03-02"}
        gaps = publish_daily.find_gaps_since_last_entry(existing, "2026-03-03")
        assert gaps == []

    def test_finds_gap_over_skipped_day(self):
        existing = {"2026-03-02"}  # Monday
        # Skip Tue, publish Wed
        gaps = publish_daily.find_gaps_since_last_entry(existing, "2026-03-04")
        assert "2026-03-03" in gaps

    def test_empty_existing_returns_empty(self):
        gaps = publish_daily.find_gaps_since_last_entry(set(), "2026-03-04")
        assert gaps == []

    def test_new_date_before_latest_returns_empty(self):
        existing = {"2026-03-05"}
        gaps = publish_daily.find_gaps_since_last_entry(existing, "2026-03-02")
        assert gaps == []


# ---------------------------------------------------------------------------
# generate_entries_html & generate_card
# ---------------------------------------------------------------------------

class TestGenerateEntriesHtml:
    def test_empty_entries(self):
        assert publish_daily.generate_entries_html({}) == ""

    def test_single_entry_has_month_header(self):
        entries = {"2026-03-02": {"description": "Test"}}
        html = publish_daily.generate_entries_html(entries)
        assert "March 2026" in html
        assert "2026-03-02.html" in html

    def test_entries_sorted_descending(self):
        entries = {
            "2026-03-02": {"description": "A"},
            "2026-03-05": {"description": "B"},
            "2026-03-03": {"description": "C"},
        }
        html = publish_daily.generate_entries_html(entries)
        pos_05 = html.find("2026-03-05")
        pos_03 = html.find("2026-03-03")
        pos_02 = html.find("2026-03-02")
        assert pos_05 < pos_03 < pos_02

    def test_groups_by_month(self):
        entries = {
            "2026-02-27": {"description": "Feb entry"},
            "2026-03-02": {"description": "Mar entry"},
        }
        html = publish_daily.generate_entries_html(entries)
        assert "March 2026" in html
        assert "February 2026" in html


class TestGenerateCard:
    def test_card_structure(self):
        card = publish_daily.generate_card(
            "2026-03-02", datetime(2026, 3, 2), "My desc"
        )
        assert 'class="update-card"' in card
        assert 'href="2026-03-02.html"' in card
        assert "My desc" in card
        assert "Daily Market Update" in card


# ---------------------------------------------------------------------------
# update_sitemap
# ---------------------------------------------------------------------------

class TestUpdateSitemap:
    def test_generates_sitemap(self, tmp_path, monkeypatch):
        # Set up paths in tmp_path
        monkeypatch.setattr(publish_daily, "SCRIPT_DIR", str(tmp_path))
        daily_dir = tmp_path / "autotrader" / "daily"
        daily_dir.mkdir(parents=True)
        index_path = str(daily_dir / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        # Create index with one entry
        card = _make_card_html("2026-03-02", "Test")
        with open(index_path, "w") as f:
            f.write(_make_index_html(card + "\n"))

        publish_daily.update_sitemap()

        sitemap_path = tmp_path / "sitemap.xml"
        assert sitemap_path.exists()
        content = sitemap_path.read_text()
        assert '<?xml version="1.0"' in content
        assert "daliu.github.io/autotrader/daily/2026-03-02.html" in content
        assert "daliu.github.io/" in content

    def test_sitemap_includes_static_pages(self, tmp_path, monkeypatch):
        monkeypatch.setattr(publish_daily, "SCRIPT_DIR", str(tmp_path))
        daily_dir = tmp_path / "autotrader" / "daily"
        daily_dir.mkdir(parents=True)
        index_path = str(daily_dir / "index.html")
        monkeypatch.setattr(publish_daily, "INDEX_PATH", index_path)

        # No daily entries — index file doesn't exist
        publish_daily.update_sitemap()

        content = (tmp_path / "sitemap.xml").read_text()
        assert "daliu.github.io/" in content
        assert "portfolio.html" in content
        assert "autotrader.html" in content
        assert "health/" in content


# ---------------------------------------------------------------------------
# generate_placeholder_html_file
# ---------------------------------------------------------------------------

class TestGeneratePlaceholderHtmlFile:
    def test_creates_file(self, tmp_path, monkeypatch):
        monkeypatch.setattr(publish_daily, "DAILY_DIR", str(tmp_path))

        date_str = "2026-03-10"
        date_obj = datetime(2026, 3, 10)
        publish_daily.generate_placeholder_html_file(date_str, date_obj)

        path = tmp_path / "2026-03-10.html"
        assert path.exists()
        content = path.read_text()
        assert publish_daily.PLACEHOLDER_MESSAGE in content
        assert "March 10, 2026" in content
