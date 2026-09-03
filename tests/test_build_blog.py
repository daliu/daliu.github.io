"""Tests for scripts/build_blog.py — the career-blog build pipeline.

Covers: frontmatter parsing, the publish-gate filter (the hard safety
requirement — a publish: false / missing-flag post must NOT appear in output),
slug derivation, post-page + index generation, the Atom feed (blog/feed.xml
+ the <link rel="alternate"> discovery tag in the index head), the additive
sitemap merge (must preserve non-blog entries), the overwrite guard, and
idempotency.

Mirrors the style of tests/test_publish_daily.py.
"""

import os
import sys

import pytest

# Ensure scripts/ is importable so we can import build_blog.
sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
)

import build_blog  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_post(blog_src, filename, frontmatter, body="Hello **world**."):
    """Write a markdown post with the given frontmatter dict + body."""
    lines = ["---"]
    for k, v in frontmatter.items():
        if isinstance(v, list):
            lines.append(f"{k}: [{', '.join(v)}]")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    lines.append("")
    lines.append(body)
    os.makedirs(blog_src, exist_ok=True)
    with open(os.path.join(blog_src, filename), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def _make_vault(tmp_path):
    """Return (vault_path, blog_src_dir) under tmp_path."""
    vault = tmp_path / "vault"
    blog_src = vault / "wiki" / "blog"
    blog_src.mkdir(parents=True)
    return str(vault), str(blog_src)


# ---------------------------------------------------------------------------
# parse_frontmatter
# ---------------------------------------------------------------------------

class TestParseFrontmatter:
    def test_basic_scalars(self):
        content = '---\ntitle: "Hi"\ndate: 2026-06-28\npublish: true\n---\nBody here'
        fm, body = build_blog.parse_frontmatter(content)
        assert fm["title"] == "Hi"
        assert fm["date"] == "2026-06-28"
        assert fm["publish"] == "true"
        assert "Body here" in body

    def test_inline_list(self):
        content = "---\ntags: [career, engineering]\n---\nx"
        fm, _ = build_blog.parse_frontmatter(content)
        assert fm["tags"] == ["career", "engineering"]

    def test_block_list(self):
        content = "---\ntags:\n  - career\n  - meta\n---\nx"
        fm, _ = build_blog.parse_frontmatter(content)
        assert fm["tags"] == ["career", "meta"]

    def test_no_frontmatter(self):
        fm, body = build_blog.parse_frontmatter("just text, no fm")
        assert fm == {}
        assert body == "just text, no fm"


# ---------------------------------------------------------------------------
# is_published — THE PUBLISH GATE
# ---------------------------------------------------------------------------

class TestIsPublished:
    def test_string_true(self):
        assert build_blog.is_published({"publish": "true"}) is True

    def test_string_true_mixed_case(self):
        assert build_blog.is_published({"publish": "True"}) is True

    def test_bool_true(self):
        assert build_blog.is_published({"publish": True}) is True

    def test_missing_is_false(self):
        assert build_blog.is_published({}) is False

    def test_string_false_is_false(self):
        assert build_blog.is_published({"publish": "false"}) is False

    def test_bool_false_is_false(self):
        assert build_blog.is_published({"publish": False}) is False

    def test_garbage_is_false(self):
        # Fails CLOSED — anything that isn't true is a draft.
        assert build_blog.is_published({"publish": "yes"}) is False


# ---------------------------------------------------------------------------
# slug_from_filename
# ---------------------------------------------------------------------------

class TestSlug:
    def test_strips_date_prefix(self):
        assert build_blog.slug_from_filename("2026-06-28-welcome.md", {}) == "welcome"

    def test_frontmatter_slug_wins(self):
        assert build_blog.slug_from_filename("2026-06-28-welcome.md", {"slug": "custom"}) == "custom"

    def test_no_date_prefix(self):
        assert build_blog.slug_from_filename("about.md", {}) == "about"


# ---------------------------------------------------------------------------
# load_posts — the publish gate end-to-end
# ---------------------------------------------------------------------------

class TestLoadPosts:
    def test_published_post_included(self, tmp_path):
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "2026-06-28-hi.md",
                    {"title": '"Hi"', "date": "2026-06-28", "publish": "true"})
        posts = build_blog.load_posts(vault)
        assert len(posts) == 1
        assert posts[0]["slug"] == "hi"
        assert posts[0]["title"] == "Hi"

    def test_draft_missing_flag_excluded(self, tmp_path):
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "2026-06-28-draft.md",
                    {"title": '"Draft"', "date": "2026-06-28"})  # no publish flag
        posts = build_blog.load_posts(vault)
        assert posts == []

    def test_publish_false_excluded(self, tmp_path):
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "2026-06-28-secret.md",
                    {"title": '"Secret"', "date": "2026-06-28", "publish": "false"})
        posts = build_blog.load_posts(vault)
        assert posts == []

    def test_mixed_only_published_survive(self, tmp_path):
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "2026-06-28-live.md",
                    {"title": '"Live"', "date": "2026-06-28", "publish": "true"})
        _write_post(blog_src, "2026-06-29-draft.md",
                    {"title": '"Draft"', "date": "2026-06-29", "publish": "false"})
        posts = build_blog.load_posts(vault)
        assert len(posts) == 1
        assert posts[0]["slug"] == "live"

    def test_readme_meta_file_excluded(self, tmp_path):
        # A folder README without publish: true must never leak.
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "README.md", {"type": "meta", "title": '"Readme"'})
        posts = build_blog.load_posts(vault)
        assert posts == []

    def test_sorted_newest_first(self, tmp_path):
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "2026-06-01-old.md",
                    {"title": '"Old"', "date": "2026-06-01", "publish": "true"})
        _write_post(blog_src, "2026-06-28-new.md",
                    {"title": '"New"', "date": "2026-06-28", "publish": "true"})
        posts = build_blog.load_posts(vault)
        assert [p["slug"] for p in posts] == ["new", "old"]

    def test_markdown_body_rendered(self, tmp_path):
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "2026-06-28-md.md",
                    {"title": '"MD"', "date": "2026-06-28", "publish": "true"},
                    body="A **bold** word and a list:\n\n- one\n- two")
        posts = build_blog.load_posts(vault)
        body = posts[0]["body_html"]
        assert "<strong>bold</strong>" in body
        assert "<li>one</li>" in body

    def test_missing_blog_dir_returns_empty(self, tmp_path):
        # No wiki/blog folder at all.
        posts = build_blog.load_posts(str(tmp_path / "nonexistent"))
        assert posts == []


# ---------------------------------------------------------------------------
# Page generation
# ---------------------------------------------------------------------------

def _sample_post():
    from datetime import datetime
    return {
        "slug": "welcome",
        "title": "My First Post",
        "date": "2026-06-28",
        "date_obj": datetime(2026, 6, 28),
        "tags": ["career", "meta"],
        "description": "An intro post.",
        "body_html": "<p>Hello <strong>world</strong>.</p>",
    }


class TestGeneratePostPage:
    def setup_method(self):
        self.html = build_blog.generate_post_page(_sample_post())

    def test_valid_html(self):
        assert self.html.startswith("<!DOCTYPE html>")
        assert "</html>" in self.html

    def test_title_and_description(self):
        assert "<title>My First Post — Dave Liu</title>" in self.html
        assert 'content="An intro post."' in self.html

    def test_canonical_and_og(self):
        assert 'href="https://daliu.github.io/blog/welcome.html"' in self.html
        assert 'property="og:type" content="article"' in self.html
        assert 'property="og:url" content="https://daliu.github.io/blog/welcome.html"' in self.html

    def test_branding(self):
        assert "G-GR5Z815VXW" in self.html
        assert "favicon.svg" in self.html
        assert "#2f2f2f" in self.html
        assert "1abc9c" in self.html

    def test_nav_has_blog_entry(self):
        assert '<a href="../blog/">Blog</a>' in self.html

    def test_body_rendered_in_page(self):
        assert "<p>Hello <strong>world</strong>.</p>" in self.html

    def test_tags_rendered(self):
        assert "career" in self.html and "meta" in self.html


class TestGenerateIndexPage:
    def test_index_has_markers_and_card(self):
        html = build_blog.generate_index_page([_sample_post()])
        assert build_blog.BEGIN_MARK in html
        assert build_blog.END_MARK in html
        assert 'href="welcome.html"' in html
        assert "My First Post" in html

    def test_empty_index_no_cards(self):
        html = build_blog.generate_index_page([])
        assert "No posts yet" in html
        assert 'class="card"' not in html

    def test_index_title_and_canonical(self):
        html = build_blog.generate_index_page([])
        assert "<title>Blog — Dave Liu</title>" in html
        assert 'href="https://daliu.github.io/blog/"' in html


class TestSpliceIndex:
    def test_splice_preserves_chrome(self):
        original = build_blog.generate_index_page([])
        # Splice in a post; the <head>/<nav> chrome must be unchanged.
        spliced = build_blog.splice_index(original, [_sample_post()])
        assert "<title>Blog — Dave Liu</title>" in spliced
        assert 'href="welcome.html"' in spliced
        # Only one marker pair remains (no duplication).
        assert spliced.count(build_blog.BEGIN_MARK) == 1
        assert spliced.count(build_blog.END_MARK) == 1

    def test_splice_idempotent(self):
        original = build_blog.generate_index_page([_sample_post()])
        once = build_blog.splice_index(original, [_sample_post()])
        twice = build_blog.splice_index(once, [_sample_post()])
        assert once == twice


# ---------------------------------------------------------------------------
# Atom feed (blog/feed.xml + index <head> discovery link)
# ---------------------------------------------------------------------------

class TestGenerateFeed:
    def _parse(self, xml_text):
        import xml.etree.ElementTree as ET
        return ET.fromstring(xml_text)

    def test_well_formed_atom(self):
        root = self._parse(build_blog.generate_feed([_sample_post()]))
        assert root.tag == "{http://www.w3.org/2005/Atom}feed"

    def test_entry_fields(self):
        ns = {"a": "http://www.w3.org/2005/Atom"}
        root = self._parse(build_blog.generate_feed([_sample_post()]))
        entries = root.findall("a:entry", ns)
        assert len(entries) == 1
        e = entries[0]
        assert e.find("a:title", ns).text == "My First Post"
        assert e.find("a:id", ns).text == "https://daliu.github.io/blog/welcome.html"
        assert e.find("a:link", ns).get("href") == "https://daliu.github.io/blog/welcome.html"
        assert e.find("a:updated", ns).text == "2026-06-28T00:00:00Z"
        assert e.find("a:summary", ns).text == "An intro post."

    def test_content_is_escaped_html(self):
        ns = {"a": "http://www.w3.org/2005/Atom"}
        root = self._parse(build_blog.generate_feed([_sample_post()]))
        content = root.find("a:entry/a:content", ns)
        assert content.get("type") == "html"
        # ElementTree unescapes on parse — the round-tripped text is the HTML.
        assert content.text == "<p>Hello <strong>world</strong>.</p>"

    def test_tags_become_categories(self):
        ns = {"a": "http://www.w3.org/2005/Atom"}
        root = self._parse(build_blog.generate_feed([_sample_post()]))
        terms = [c.get("term") for c in root.findall("a:entry/a:category", ns)]
        assert terms == ["career", "meta"]

    def test_feed_updated_is_newest_post_date(self):
        ns = {"a": "http://www.w3.org/2005/Atom"}
        root = self._parse(build_blog.generate_feed([_sample_post()]))
        assert root.find("a:updated", ns).text == "2026-06-28T00:00:00Z"

    def test_self_and_alternate_links(self):
        feed = build_blog.generate_feed([_sample_post()])
        assert 'rel="self"' in feed
        assert "https://daliu.github.io/blog/feed.xml" in feed
        assert 'href="https://daliu.github.io/blog/"' in feed

    def test_empty_feed_no_entries_still_valid(self):
        ns = {"a": "http://www.w3.org/2005/Atom"}
        root = self._parse(build_blog.generate_feed([]))
        assert root.findall("a:entry", ns) == []
        assert root.find("a:updated", ns).text is not None

    def test_deterministic(self):
        # No wall-clock anywhere — two builds are byte-identical.
        assert build_blog.generate_feed([_sample_post()]) == \
            build_blog.generate_feed([_sample_post()])

    def test_title_escaped(self):
        post = dict(_sample_post(), title="Ampersands & <angles>")
        ns = {"a": "http://www.w3.org/2005/Atom"}
        root = self._parse(build_blog.generate_feed([post]))
        assert root.find("a:entry/a:title", ns).text == "Ampersands & <angles>"


class TestFeedDiscoveryLink:
    def test_generated_index_has_alternate_link(self):
        html = build_blog.generate_index_page([_sample_post()])
        assert build_blog.FEED_LINK_TAG in html
        # In the head, before the body starts.
        assert html.index(build_blog.FEED_LINK_TAG) < html.index("<body>")

    def test_post_pages_do_not_get_the_link(self):
        # The backlog item scopes discovery to the index head only.
        assert build_blog.FEED_LINK_TAG not in build_blog.generate_post_page(_sample_post())

    def test_splice_injects_link_into_legacy_chrome(self):
        legacy = build_blog.generate_index_page([]).replace(
            "\n  " + build_blog.FEED_LINK_TAG, "")
        assert build_blog.FEED_LINK_TAG not in legacy
        spliced = build_blog.splice_index(legacy, [_sample_post()])
        assert spliced.count(build_blog.FEED_LINK_TAG) == 1
        assert spliced.index(build_blog.FEED_LINK_TAG) < spliced.index("<body>")

    def test_splice_idempotent_with_link(self):
        once = build_blog.splice_index(
            build_blog.generate_index_page([_sample_post()]), [_sample_post()])
        twice = build_blog.splice_index(once, [_sample_post()])
        assert once == twice
        assert twice.count(build_blog.FEED_LINK_TAG) == 1

    def test_ensure_feed_link_no_canonical_falls_back_to_head_close(self):
        html = "<html><head><title>x</title></head><body></body></html>"
        out = build_blog.ensure_feed_link(html)
        assert build_blog.FEED_LINK_TAG in out
        assert out.index(build_blog.FEED_LINK_TAG) < out.index("</head>")


# ---------------------------------------------------------------------------
# Sitemap merge (additive — must NOT clobber non-blog entries)
# ---------------------------------------------------------------------------

EXISTING_SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://daliu.github.io/</loc>
    <lastmod>2026-06-26</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://daliu.github.io/autotrader/daily/2026-02-18.html</loc>
    <lastmod>2026-02-18</lastmod>
    <priority>0.5</priority>
  </url>
</urlset>
"""


class TestMergeSitemap:
    def test_preserves_non_blog_entries(self):
        out = build_blog.merge_sitemap(EXISTING_SITEMAP, [_sample_post()])
        assert "https://daliu.github.io/" in out
        assert "https://daliu.github.io/autotrader/daily/2026-02-18.html" in out

    def test_adds_blog_urls(self):
        out = build_blog.merge_sitemap(EXISTING_SITEMAP, [_sample_post()])
        assert "https://daliu.github.io/blog/" in out
        assert "https://daliu.github.io/blog/welcome.html" in out

    def test_merge_idempotent(self):
        once = build_blog.merge_sitemap(EXISTING_SITEMAP, [_sample_post()])
        twice = build_blog.merge_sitemap(once, [_sample_post()])
        # No duplicate blog URLs across re-runs.
        assert once.count("https://daliu.github.io/blog/welcome.html") == 1
        assert twice.count("https://daliu.github.io/blog/welcome.html") == 1
        assert once.count("autotrader/daily/2026-02-18.html") == 1
        assert twice.count("autotrader/daily/2026-02-18.html") == 1

    def test_removed_post_drops_from_sitemap(self):
        with_post = build_blog.merge_sitemap(EXISTING_SITEMAP, [_sample_post()])
        # Now the post is unpublished — it must disappear from the sitemap.
        without = build_blog.merge_sitemap(with_post, [])
        assert "blog/welcome.html" not in without
        # but the blog index + autotrader entry remain.
        assert "https://daliu.github.io/blog/" in without
        assert "autotrader/daily/2026-02-18.html" in without

    def test_no_existing_file_builds_minimal(self):
        out = build_blog.merge_sitemap(None, [_sample_post()])
        assert out.startswith('<?xml')
        assert "https://daliu.github.io/blog/welcome.html" in out
        assert out.rstrip().endswith("</urlset>")


# ---------------------------------------------------------------------------
# Overwrite guard + full build / idempotency
# ---------------------------------------------------------------------------

class TestBuildAndGuard:
    def _point_at_tmp(self, tmp_path, monkeypatch):
        blog_dir = tmp_path / "repo" / "blog"
        blog_dir.mkdir(parents=True)
        sitemap = tmp_path / "repo" / "sitemap.xml"
        sitemap.write_text(EXISTING_SITEMAP)
        monkeypatch.setattr(build_blog, "BLOG_DIR", str(blog_dir))
        monkeypatch.setattr(build_blog, "SITEMAP_PATH", str(sitemap))
        return str(blog_dir), str(sitemap)

    def _write_index(self, blog_dir, posts):
        with open(os.path.join(blog_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(build_blog.generate_index_page(posts))

    def test_build_writes_pages(self, tmp_path, monkeypatch):
        blog_dir, _ = self._point_at_tmp(tmp_path, monkeypatch)
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "2026-06-28-hi.md",
                    {"title": '"Hi"', "date": "2026-06-28", "publish": "true"})
        posts, outputs = build_blog.build(vault)
        assert len(posts) == 1
        assert os.path.join(blog_dir, "hi.html") in outputs
        assert os.path.join(blog_dir, "index.html") in outputs
        assert os.path.join(blog_dir, "feed.xml") in outputs
        assert "<title>Hi</title>" in outputs[os.path.join(blog_dir, "feed.xml")]

    def test_build_idempotent(self, tmp_path, monkeypatch):
        blog_dir, _ = self._point_at_tmp(tmp_path, monkeypatch)
        vault, blog_src = _make_vault(tmp_path)
        _write_post(blog_src, "2026-06-28-hi.md",
                    {"title": '"Hi"', "date": "2026-06-28", "publish": "true"})
        _, outputs1 = build_blog.build(vault)
        # Write the outputs to disk, then rebuild — content must be identical.
        for path, content in outputs1.items():
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        _, outputs2 = build_blog.build(vault)
        for path, content in outputs2.items():
            with open(path, "r", encoding="utf-8") as f:
                assert f.read() == content

    def test_overwrite_guard_refuses_empty_wipe(self, tmp_path, monkeypatch):
        blog_dir, _ = self._point_at_tmp(tmp_path, monkeypatch)
        # Pre-populate a non-empty index (simulating prior published posts)...
        self._write_index(blog_dir, [_sample_post()])
        # ...then build from an EMPTY vault (no published posts). Must refuse.
        empty_vault = str(tmp_path / "empty_vault")
        os.makedirs(os.path.join(empty_vault, "wiki", "blog"))
        with pytest.raises(SystemExit):
            build_blog.build(empty_vault)

    def test_guard_allows_legit_empty_when_index_empty(self, tmp_path, monkeypatch):
        blog_dir, _ = self._point_at_tmp(tmp_path, monkeypatch)
        # Index exists but lists no posts — an empty build is legitimately fine.
        self._write_index(blog_dir, [])
        empty_vault = str(tmp_path / "empty_vault")
        os.makedirs(os.path.join(empty_vault, "wiki", "blog"))
        posts, outputs = build_blog.build(empty_vault)
        assert posts == []
        assert outputs  # still produced an (empty) index + sitemap


class TestIndexHasPublishedCards:
    def test_true_when_cards_present(self, tmp_path):
        path = tmp_path / "index.html"
        path.write_text(build_blog.generate_index_page([_sample_post()]))
        assert build_blog.index_has_published_cards(str(path)) is True

    def test_false_when_empty(self, tmp_path):
        path = tmp_path / "index.html"
        path.write_text(build_blog.generate_index_page([]))
        assert build_blog.index_has_published_cards(str(path)) is False

    def test_false_when_missing(self, tmp_path):
        assert build_blog.index_has_published_cards(str(tmp_path / "nope.html")) is False
