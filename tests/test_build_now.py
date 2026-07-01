"""Tests for build_now.py — the /now/ page generator sourced from wiki/now.md.

Covers: frontmatter parsing, marker splice, idempotency, the overwrite guard,
the "Last updated" stamp, and that known sections/links render into the output.
"""

import os
import sys

import pytest

# Ensure scripts/ is importable (build_now lives under scripts/, like build_graph).
sys.path.insert(
    0,
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"),
)

import build_now


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

SAMPLE_MD = """---
type: now
title: "Now"
updated: 2026-06-30
---

<!-- a convention comment that must not render -->

## Currently working on

**AutoTrader** — market prediction. [Overview](../autotrader.html).

**Meta Council** — decision support. Live demo at <a href="https://meta-council.com" target="_blank">meta-council.com</a>.

## What's not here

I deliberately don't list every project. See [portfolio](../portfolio.html).
"""


def _target_html(begin_extra="", body="  <h1>Old</h1>"):
    """Minimal now/index.html with the content markers around placeholder body."""
    return (
        "<html><body>\n"
        '<div class="container-narrow">\n'
        f"  {build_now.BEGIN_MARK}{begin_extra} -->\n"
        f"{body}\n"
        f"  {build_now.END_MARK}\n"
        "</div>\n"
        "</body></html>"
    )


# ---------------------------------------------------------------------------
# parse_frontmatter
# ---------------------------------------------------------------------------

class TestParseFrontmatter:
    def test_extracts_keys(self):
        fm, body = build_now.parse_frontmatter(SAMPLE_MD)
        assert fm["type"] == "now"
        assert fm["title"] == "Now"
        assert fm["updated"] == "2026-06-30"

    def test_body_excludes_frontmatter(self):
        _, body = build_now.parse_frontmatter(SAMPLE_MD)
        assert "type: now" not in body
        assert "## Currently working on" in body

    def test_no_frontmatter_returns_empty(self):
        fm, body = build_now.parse_frontmatter("# no frontmatter\n")
        assert fm == {}
        assert body == "# no frontmatter\n"


# ---------------------------------------------------------------------------
# _updated_label
# ---------------------------------------------------------------------------

class TestUpdatedLabel:
    def test_iso_date_to_month_year(self):
        assert build_now._updated_label("2026-06-30") == "June 2026"
        assert build_now._updated_label("2026-01-05") == "January 2026"

    def test_non_date_passthrough(self):
        assert build_now._updated_label("someday") == "someday"


# ---------------------------------------------------------------------------
# render_content
# ---------------------------------------------------------------------------

class TestRenderContent:
    def setup_method(self):
        fm, body = build_now.parse_frontmatter(SAMPLE_MD)
        self.html = build_now.render_content(fm, body)

    def test_fixed_chrome_present(self):
        assert '<h1>Now <span class="now-dot">●</span></h1>' in self.html
        assert 'class="subtitle"' in self.html
        assert 'class="what-this"' in self.html

    def test_section_heading_rendered(self):
        assert "<h2>Currently working on</h2>" in self.html
        assert "<h2>What's not here</h2>" in self.html

    def test_each_block_becomes_a_card(self):
        # Two blocks in "Currently working on" + one in "What's not here" = 3 cards.
        assert self.html.count('<div class="card">') == 3

    def test_bold_and_link_render(self):
        assert "<strong>AutoTrader</strong>" in self.html
        assert '<a href="../autotrader.html">Overview</a>' in self.html

    def test_raw_html_link_passthrough(self):
        # target="_blank" must survive (written as raw HTML in the source).
        assert '<a href="https://meta-council.com" target="_blank">meta-council.com</a>' in self.html

    def test_comment_stripped(self):
        assert "convention comment" not in self.html

    def test_last_updated_from_frontmatter(self):
        assert '<p class="meta">Last updated: June 2026.</p>' in self.html


# ---------------------------------------------------------------------------
# splice
# ---------------------------------------------------------------------------

class TestSplice:
    def test_replaces_between_markers(self):
        html = _target_html(body="  <h1>Old</h1>")
        block = build_now.build_block(*build_now.parse_frontmatter(SAMPLE_MD))
        out = build_now.splice(html, block)
        assert "<h1>Old</h1>" not in out
        assert "<h2>Currently working on</h2>" in out
        # Chrome outside the markers is preserved.
        assert '<div class="container-narrow">' in out
        assert out.startswith("<html><body>")

    def test_missing_markers_raises(self):
        with pytest.raises(SystemExit):
            build_now.splice("<html>no markers</html>", "block")

    def test_begin_line_indent_uniform(self):
        # Even if the source BEGIN line had extra text, the rewritten one is used.
        html = _target_html(begin_extra=" — stale annotation")
        block = build_now.build_block(*build_now.parse_frontmatter(SAMPLE_MD))
        out = build_now.splice(html, block)
        assert "stale annotation" not in out
        assert build_now.BEGIN_LINE.strip() in out


# ---------------------------------------------------------------------------
# main() — end-to-end write, idempotency, overwrite guard, drift check
# ---------------------------------------------------------------------------

class TestMain:
    def _setup(self, tmp_path, monkeypatch, md=SAMPLE_MD, target_body="  <h1>Old</h1>"):
        vault = tmp_path / "vault"
        (vault / "wiki").mkdir(parents=True)
        (vault / "wiki" / "now.md").write_text(md, encoding="utf-8")
        target = tmp_path / "now" / "index.html"
        target.parent.mkdir(parents=True)
        target.write_text(_target_html(body=target_body), encoding="utf-8")
        monkeypatch.setattr(build_now, "TARGET", str(target))
        monkeypatch.setattr(sys, "argv", ["build_now.py", "--vault", str(vault)])
        return vault, target

    def test_writes_content(self, tmp_path, monkeypatch):
        _, target = self._setup(tmp_path, monkeypatch)
        rc = build_now.main()
        assert rc == 0
        content = target.read_text()
        assert "<h2>Currently working on</h2>" in content
        assert '<a href="../portfolio.html">portfolio</a>' in content
        assert "Last updated: June 2026." in content

    def test_idempotent_no_second_write(self, tmp_path, monkeypatch):
        _, target = self._setup(tmp_path, monkeypatch)
        build_now.main()
        first = target.read_text()
        mtime1 = target.stat().st_mtime_ns
        # Second run: no source change → no write (content identical).
        rc = build_now.main()
        assert rc == 0
        assert target.read_text() == first
        # Guard against re-write: main() returns before opening for write.
        assert target.stat().st_mtime_ns == mtime1

    def test_check_reports_drift(self, tmp_path, monkeypatch, capsys):
        _, target = self._setup(tmp_path, monkeypatch)
        monkeypatch.setattr(
            sys, "argv",
            ["build_now.py", "--vault", str(tmp_path / "vault"), "--check"],
        )
        rc = build_now.main()
        assert rc == 1  # target still has the stale <h1>Old</h1> body
        assert "DRIFT" in capsys.readouterr().err

    def test_check_in_sync_after_build(self, tmp_path, monkeypatch):
        vault, target = self._setup(tmp_path, monkeypatch)
        build_now.main()  # bring in sync
        monkeypatch.setattr(
            sys, "argv", ["build_now.py", "--vault", str(vault), "--check"]
        )
        assert build_now.main() == 0

    def test_overwrite_guard_empty_body(self, tmp_path, monkeypatch):
        # now.md with frontmatter but no section content → refuse, don't blank.
        md = '---\ntype: now\ntitle: "Now"\nupdated: 2026-06-30\n---\n\n'
        _, target = self._setup(tmp_path, monkeypatch, md=md)
        before = target.read_text()
        with pytest.raises(SystemExit):
            build_now.main()
        assert target.read_text() == before  # content region untouched

    def test_missing_source_raises(self, tmp_path, monkeypatch):
        vault = tmp_path / "vault"
        (vault / "wiki").mkdir(parents=True)  # no now.md
        monkeypatch.setattr(sys, "argv", ["build_now.py", "--vault", str(vault)])
        with pytest.raises(SystemExit):
            build_now.main()
