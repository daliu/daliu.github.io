#!/usr/bin/env python3
"""Build the career/professional blog at https://daliu.github.io/blog/ from the
dedicated Obsidian source folder ~/Documents/Remote Vault/wiki/blog/.

Why this exists: blog posts are authored where Dave already writes — a markdown
file per post in the vault. This script reads those files, renders each post's
markdown body to HTML, wraps it in the shared site chrome (dark navbar #2f2f2f,
teal accent #1abc9c, GA4, OG tags — matching now/index.html), and publishes:

  * blog/<slug>.html      — one page per published post
  * blog/index.html       — dated cards, newest first, spliced between the
                            <!-- BEGIN auto:blog-index --> / <!-- END ... --> markers
  * sitemap.xml           — blog index + every post URL

THE PUBLISH GATE (hard safety requirement). A post is published if and ONLY if
its YAML frontmatter has `publish: true`. Drafts (publish omitted or false) are
skipped. This fails CLOSED: an unflagged note never leaks. Mirrors the opt-in
policy in build_graph.py.

Overwrite guard (mirrors build_graph.py): if the vault read returns zero
published posts but blog/index.html already lists posts, refuse to wipe it —
the vault was probably unsync'd (iCloud dataless placeholders). The local
sync wrapper (scripts/sync-blog.sh) materializes the vault first; this guard
is the safety net if that times out.

Dependency: the `markdown` PyPI lib (pinned markdown>=3.6,<4). The repo had no
markdown->HTML renderer before this. Install with:

    python3 -m pip install 'markdown>=3.6,<4'

Usage:
    python3 scripts/build_blog.py                  # build from default vault
    python3 scripts/build_blog.py --vault PATH      # build from a specific vault
    python3 scripts/build_blog.py --check           # exit 1 if the site has drifted

Idempotent: re-running with no source changes yields no diff.
"""

import argparse
import html
import os
import re
import sys
from datetime import datetime

import markdown

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_VAULT = os.path.expanduser("~/Documents/Remote Vault")
BLOG_DIR = os.path.join(REPO, "blog")
SITEMAP_PATH = os.path.join(REPO, "sitemap.xml")

SITE = "https://daliu.github.io"
GA4_ID = "G-GR5Z815VXW"
OG_IMAGE = f"{SITE}/images/og-card.png"

BEGIN_MARK = "<!-- BEGIN auto:blog-index -->"
END_MARK = "<!-- END auto:blog-index -->"

# Keep the markdown feature set small and safe.
MD_EXTENSIONS = ["fenced_code", "tables", "toc"]

# The blog index URL — this and every /blog/<slug>.html are the ONLY entries
# this script owns in sitemap.xml. publish_daily.py owns the rest (static pages
# + autotrader daily pages); we merge additively so neither clobbers the other.
BLOG_INDEX_LOC = f"{SITE}/blog/"


# --------------------------------------------------------------------------- #
# Frontmatter parsing (no PyYAML — mirror build_graph.parse_frontmatter)
# --------------------------------------------------------------------------- #

def parse_frontmatter(content):
    """Extract YAML frontmatter from markdown content (no PyYAML dependency).

    Returns (frontmatter_dict, body). Supports scalars, inline `[a, b]` lists,
    and dashed block lists — the same subset build_graph.py supports.
    """
    if not content.startswith("---"):
        return {}, content
    end = content.find("---", 3)
    if end == -1:
        return {}, content
    fm_text = content[3:end]
    body = content[end + 3:]
    fm = {}
    current_key = None
    current_list = None
    for line in fm_text.strip().split("\n"):
        list_match = re.match(r"^\s+-\s+(.+)", line)
        if list_match and current_key:
            if current_list is None:
                current_list = []
                fm[current_key] = current_list
            current_list.append(list_match.group(1).strip().strip('"').strip("'"))
            continue
        kv_match = re.match(r"^(\w[\w_]*)\s*:\s*(.*)", line)
        if kv_match:
            current_key = kv_match.group(1)
            val = kv_match.group(2).strip().strip('"').strip("'")
            current_list = None
            if val == "" or val == "[]":
                fm[current_key] = []
                current_list = fm[current_key]
            elif val.startswith("[") and val.endswith("]"):
                fm[current_key] = [
                    v.strip().strip('"').strip("'")
                    for v in val[1:-1].split(",") if v.strip()
                ]
            else:
                fm[current_key] = val
    return fm, body


def is_published(fm):
    """The publish gate: True only if frontmatter has publish: true (string or
    bool). Fails CLOSED — missing/false/anything-else means draft."""
    val = fm.get("publish")
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() == "true"


def slug_from_filename(filename, fm):
    """Slug = frontmatter `slug` if present, else the filename minus a leading
    YYYY-MM-DD- date prefix and the .md extension."""
    if fm.get("slug"):
        return str(fm["slug"]).strip()
    name = os.path.splitext(os.path.basename(filename))[0]
    return re.sub(r"^\d{4}-\d{2}-\d{2}-", "", name)


# --------------------------------------------------------------------------- #
# Source loading
# --------------------------------------------------------------------------- #

def load_posts(vault_path):
    """Read wiki/blog/*.md, parse frontmatter, filter to publish: true.

    Returns a list of post dicts sorted newest-first, each with keys:
    slug, title, date (str), date_obj, tags (list), description, body_html.
    Drafts (publish != true) and the folder's README/meta files are skipped.
    """
    blog_src = os.path.join(vault_path, "wiki", "blog")
    posts = []
    if not os.path.isdir(blog_src):
        return posts

    for filename in sorted(os.listdir(blog_src)):
        if not filename.endswith(".md"):
            continue
        path = os.path.join(blog_src, filename)
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        fm, body = parse_frontmatter(content)

        # THE PUBLISH GATE — skip anything not explicitly publish: true.
        if not is_published(fm):
            continue

        date_str = str(fm.get("date", "")).strip()
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            # Fall back to a date parsed from the filename prefix, else skip:
            m = re.match(r"^(\d{4}-\d{2}-\d{2})-", filename)
            if not m:
                print(f"  WARNING: skipping {filename}: no valid date", file=sys.stderr)
                continue
            date_str = m.group(1)
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")

        # Render the markdown body fresh each call (the Markdown instance is
        # stateful across conversions, so build a new one per post).
        md = markdown.Markdown(extensions=MD_EXTENSIONS, output_format="html5")
        body_html = md.convert(body.strip())

        posts.append({
            "slug": slug_from_filename(filename, fm),
            "title": str(fm.get("title", "")).strip() or "Untitled",
            "date": date_str,
            "date_obj": date_obj,
            "tags": fm.get("tags", []) if isinstance(fm.get("tags"), list) else [],
            "description": str(fm.get("description", "")).strip(),
            "body_html": body_html,
        })

    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts


# --------------------------------------------------------------------------- #
# Shared page chrome (mirrors now/index.html)
# --------------------------------------------------------------------------- #

def _nav(active_blog=True):
    """Shared dark navbar with a Blog entry. `..` relative paths because every
    blog page lives one directory deep (blog/...)."""
    blog_active = ' class="active"' if active_blog else ""
    return f"""<nav class="navbar navbar-default navbar-fixed-top">
  <div class="container">
    <div class="navbar-header">
      <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#myNavbar">
        <span class="icon-bar"></span>
        <span class="icon-bar"></span>
        <span class="icon-bar"></span>
      </button>
      <a class="navbar-brand" href="../index.html">Dave Liu</a>
    </div>
    <div class="collapse navbar-collapse" id="myNavbar">
      <ul class="nav navbar-nav navbar-right">
        <li><a href="../portfolio.html">Portfolio</a></li>
        <li><a href="../resume/">Resume</a></li>
        <li{blog_active}><a href="../blog/">Blog</a></li>
        <li class="dropdown">
          <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button">Data About Me <span class="caret"></span></a>
          <ul class="dropdown-menu">
            <li><a href="../index.html">Overview</a></li>
            <li><a href="../health/">Health Dashboard</a></li>
            <li><a href="../genomics/">Genomics</a></li>
            <li><a href="../analytics/">Site Analytics</a></li>
            <li><a href="../knowledge/">Knowledge Graph</a></li>
            <li><a href="../status/">System Status</a></li>
            <li><a href="../now/">Now</a></li>
          </ul>
        </li>
        <li><a href="../publications.html">Publications</a></li>
        <li class="dropdown">
          <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button">AutoTrader <span class="caret"></span></a>
          <ul class="dropdown-menu">
            <li><a href="../autotrader.html">Overview</a></li>
            <li><a href="../autotrader/daily/index.html">Daily Updates</a></li>
          </ul>
        </li>
        <li class="dropdown">
          <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button">Meta Council <span class="caret"></span></a>
          <ul class="dropdown-menu">
            <li><a href="https://meta-council.com" target="_blank">Try It</a></li>
            <li><a href="../research/meta-council-paper.pdf">Research Paper</a></li>
          </ul>
        </li>
        <li><a href="https://www.linkedin.com/in/dave-l-a3139775/" target="_blank" rel="noopener noreferrer"><span class="fa fa-linkedin"></span></a></li>
        <li><a href="https://github.com/daliu" target="_blank" rel="noopener noreferrer"><span class="fa fa-github"></span></a></li>
      </ul>
    </div>
  </div>
</nav>"""


# Shared <style> block. Kept consistent with now/index.html, with a few
# additions for rendered post bodies (blockquotes, code blocks, lists).
SHARED_STYLE = """  <style>
    :root {
      --bg: #0d1117;
      --card: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --heading: #f0f6fc;
      --muted: #8b949e;
      --accent: #58a6ff;
      --green: #3fb950;
      --teal: #1abc9c;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 0 20px 40px;
      padding-top: 70px;
    }
    .navbar { background-color: #2f2f2f !important; border: none; }
    .navbar li a, .navbar .navbar-brand { color: #fff !important; }
    .navbar-nav li a:hover, .navbar-nav li.active a { color: var(--teal) !important; background-color: #3a3a3a !important; }
    .navbar-default .navbar-toggle { border-color: transparent; color: #fff !important; }
    .navbar-default .navbar-toggle .icon-bar { background-color: #fff; }
    .navbar-default .navbar-nav .dropdown-menu { background-color: #2f2f2f; border: 1px solid #444; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .navbar-default .navbar-nav .dropdown-menu > li > a { color: #fff !important; padding: 8px 20px; background-color: #2f2f2f !important; }
    .navbar-default .navbar-nav .dropdown-menu > li > a:hover { color: var(--teal) !important; background-color: #3a3a3a !important; }
    .navbar-default .navbar-nav > .open > a,
    .navbar-default .navbar-nav > .open > a:hover { background-color: #3a3a3a !important; color: var(--teal) !important; }

    .container-narrow { max-width: 720px; margin: 0 auto; }
    h1 { color: var(--heading); font-size: 32px; font-weight: 600; margin: 30px 0 8px; }
    .subtitle { color: var(--muted); font-size: 14px; margin-bottom: 30px; }
    .post-meta { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
    .post-meta a { color: var(--teal); text-decoration: none; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px 22px;
      margin: 14px 0;
    }
    .card h2 { margin: 0 0 6px; font-size: 20px; }
    .card h2 a { color: var(--heading); }
    .card .date { color: var(--muted); font-size: 13px; }
    .card p { margin: 8px 0 0; color: var(--text); }
    .card .tags { margin-top: 10px; }
    .tag { display: inline-block; background: #21262d; color: var(--teal); font-size: 12px; padding: 2px 9px; border-radius: 10px; margin-right: 6px; }
    /* Rendered post body */
    .post-body { margin-top: 8px; }
    .post-body h2 { color: var(--accent); font-size: 22px; font-weight: 600; margin: 28px 0 10px; }
    .post-body h3 { color: var(--heading); font-size: 18px; font-weight: 600; margin: 22px 0 8px; }
    .post-body p { margin-bottom: 14px; }
    .post-body ul, .post-body ol { margin: 0 0 14px 24px; }
    .post-body li { margin-bottom: 6px; }
    .post-body blockquote {
      border-left: 3px solid var(--teal);
      padding: 4px 16px;
      margin: 16px 0;
      color: var(--muted);
      font-style: italic;
    }
    .post-body code {
      background: #21262d;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 0.9em;
      color: var(--accent);
    }
    .post-body pre {
      background: #161b22;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      overflow-x: auto;
      margin: 16px 0;
    }
    .post-body pre code { background: none; padding: 0; color: var(--text); }
    .post-body table { border-collapse: collapse; margin: 16px 0; width: 100%; }
    .post-body th, .post-body td { border: 1px solid var(--border); padding: 6px 12px; text-align: left; }
    .post-body th { background: #21262d; color: var(--heading); }
    .post-body a { color: var(--accent); }
    .back-link { display: inline-block; margin-top: 30px; color: var(--teal); font-size: 14px; }
    footer { padding: 30px 0; text-align: center; color: var(--muted); font-size: 13px; }
    footer a { color: var(--teal); }
  </style>"""


def _head(title, description, canonical, og_type):
    """Shared <head>: title, meta description, canonical, OG/twitter tags,
    GA4, favicon, bootstrap, font-awesome, shared style."""
    desc = html.escape(description or "")
    t = html.escape(title)
    return f"""<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{t}</title>
  <meta name="description" content="{desc}">
  <meta property="og:title" content="{t}">
  <meta property="og:description" content="{desc}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="{OG_IMAGE}">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="{canonical}">
  <link rel="icon" type="image/svg+xml" href="../favicon.svg">
  <!-- Google Analytics (GA4) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id={GA4_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', '{GA4_ID}');
  </script>
  <link rel="stylesheet" href="../Bootstrap%20Theme%20Company%20Page_files/bootstrap.css">
  <script src="../Bootstrap%20Theme%20Company%20Page_files/jquery.js"></script>
  <script src="../Bootstrap%20Theme%20Company%20Page_files/bootstrap.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
{SHARED_STYLE}
</head>"""


FOOTER = """<footer>
  <p style="margin-bottom: 5px;"><a href="../portfolio.html">Portfolio</a> &middot; <a href="../blog/">Blog</a> &middot; <a href="../index.html">Data About Me</a> &middot; <a href="../now/">Now</a></p>
  <p style="margin-bottom: 0;">Dave Liu &copy; 2026</p>
</footer>"""


def format_date_display(date_obj):
    """e.g. 'June 28, 2026'."""
    return date_obj.strftime("%B %-d, %Y")


# --------------------------------------------------------------------------- #
# Page generation
# --------------------------------------------------------------------------- #

def generate_post_page(post):
    """Render a single post's full HTML page."""
    canonical = f"{SITE}/blog/{post['slug']}.html"
    description = post["description"] or f"{post['title']} — a post by Dave Liu."
    tags_html = ""
    if post["tags"]:
        tags_html = '\n  <p class="tags">' + "".join(
            f'<span class="tag">{html.escape(t)}</span>' for t in post["tags"]
        ) + "</p>"
    return f"""<!DOCTYPE html>
<html lang="en">
{_head(post['title'] + " — Dave Liu", description, canonical, "article")}
<body>

{_nav(active_blog=True)}

<div class="container-narrow">

  <h1>{html.escape(post['title'])}</h1>
  <p class="post-meta">{format_date_display(post['date_obj'])} &middot; <a href="./">All posts</a></p>

  <div class="post-body">
{post['body_html']}
  </div>{tags_html}

  <a class="back-link" href="./">&larr; Back to all posts</a>

</div>

{FOOTER}

</body>
</html>
"""


def render_index_cards(posts):
    """Render the dated card list spliced between the auto:blog-index markers.

    Returns just the inner block (between BEGIN/END), newest-first.
    """
    if not posts:
        return '  <p class="subtitle">No posts yet. Check back soon.</p>'
    lines = []
    for p in posts:
        desc = html.escape(p["description"]) if p["description"] else ""
        tags_html = ""
        if p["tags"]:
            tags_html = '\n      <div class="tags">' + "".join(
                f'<span class="tag">{html.escape(t)}</span>' for t in p["tags"]
            ) + "</div>"
        lines.append(f"""    <div class="card">
      <h2><a href="{p['slug']}.html">{html.escape(p['title'])}</a></h2>
      <span class="date">{format_date_display(p['date_obj'])}</span>
      <p>{desc}</p>{tags_html}
    </div>""")
    return "\n".join(lines)


def generate_index_page(posts):
    """Full HTML for blog/index.html, with the card block between markers."""
    canonical = f"{SITE}/blog/"
    description = (
        "Dave Liu's career and engineering blog — short, honest notes on "
        "building software, working with people, and navigating a career."
    )
    cards = render_index_cards(posts)
    return f"""<!DOCTYPE html>
<html lang="en">
{_head("Blog — Dave Liu", description, canonical, "website")}
<body>

{_nav(active_blog=True)}

<div class="container-narrow">

  <h1>Blog</h1>
  <p class="subtitle">Short, honest notes on building software, working with people, and navigating a career. Synced from my notes.</p>

  {BEGIN_MARK}
{cards}
  {END_MARK}

</div>

{FOOTER}

</body>
</html>
"""


def splice_index(existing_html, posts):
    """Re-splice only the card block inside an existing index.html, preserving
    the hand-written chrome around it (mirrors build_patterns_program.splice).
    Falls back to a full regenerate if markers are absent."""
    if BEGIN_MARK not in existing_html or END_MARK not in existing_html:
        return generate_index_page(posts)
    b = existing_html.index(BEGIN_MARK)
    e = existing_html.index(END_MARK) + len(END_MARK)
    cards = render_index_cards(posts)
    block = f"{BEGIN_MARK}\n{cards}\n  {END_MARK}"
    return existing_html[:b] + block + existing_html[e:]


# --------------------------------------------------------------------------- #
# Sitemap
# --------------------------------------------------------------------------- #

def _blog_url_block(loc, lastmod, priority, changefreq=None):
    """Render one indented <url>...</url> block matching the existing sitemap
    style (2-space indent, fields in loc/lastmod/changefreq/priority order)."""
    lines = ['  <url>', f'    <loc>{loc}</loc>', f'    <lastmod>{lastmod}</lastmod>']
    if changefreq:
        lines.append(f'    <changefreq>{changefreq}</changefreq>')
    lines.append(f'    <priority>{priority}</priority>')
    lines.append('  </url>')
    return "\n".join(lines)


def _is_blog_loc(loc):
    """True for the blog URLs this script owns: the index and /blog/<slug>.html.
    Used to strip stale blog entries before re-inserting current ones — so the
    merge is idempotent and never duplicates."""
    return loc == BLOG_INDEX_LOC or (
        loc.startswith(f"{SITE}/blog/") and loc.endswith(".html")
    )


def merge_sitemap(existing_xml, posts):
    """Additively merge blog URLs into an existing sitemap.xml WITHOUT touching
    any non-blog entries (static pages, autotrader daily pages — owned by
    publish_daily.py). Strategy: drop every blog <url> block, then append the
    current blog index + post URLs before </urlset>. Idempotent.

    Falls back to a minimal blog-only sitemap if there is no existing file."""
    today = datetime.now().strftime("%Y-%m-%d")
    blog_blocks = [_blog_url_block(BLOG_INDEX_LOC, today, "0.7", "weekly")]
    for p in posts:
        blog_blocks.append(
            _blog_url_block(f"{SITE}/blog/{p['slug']}.html", p["date"], "0.6")
        )
    blog_section = "\n".join(blog_blocks)

    if not existing_xml or "</urlset>" not in existing_xml:
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{blog_section}\n</urlset>\n"
        )

    # Remove existing blog <url> blocks, preserving every other block verbatim.
    url_block_re = re.compile(r"[ \t]*<url>.*?</url>\n?", re.DOTALL)

    def _drop_blog(match):
        loc_m = re.search(r"<loc>(.*?)</loc>", match.group(0))
        if loc_m and _is_blog_loc(loc_m.group(1)):
            return ""
        return match.group(0)

    cleaned = url_block_re.sub(_drop_blog, existing_xml)
    # Insert the blog section immediately before the closing tag.
    return cleaned.replace("</urlset>", f"{blog_section}\n</urlset>")


# --------------------------------------------------------------------------- #
# Overwrite guard
# --------------------------------------------------------------------------- #

def index_has_published_cards(index_path):
    """True if an existing blog/index.html already lists at least one post card.
    Used by the overwrite guard to refuse wiping a populated index to zero."""
    if not os.path.exists(index_path):
        return False
    with open(index_path, "r", encoding="utf-8") as f:
        html_text = f.read()
    if BEGIN_MARK not in html_text or END_MARK not in html_text:
        return False
    block = html_text[html_text.index(BEGIN_MARK):html_text.index(END_MARK)]
    return 'class="card"' in block


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def build(vault_path):
    """Render all pages + sitemap from the vault. Returns a dict of
    {path: content} of files that WOULD be written (used by both write and
    --check paths so they stay identical)."""
    posts = load_posts(vault_path)

    # Overwrite guard (mirror build_graph.py): never wipe a populated index to
    # zero posts because the vault read came back empty (unsync'd iCloud).
    index_path = os.path.join(BLOG_DIR, "index.html")
    if not posts and index_has_published_cards(index_path):
        print(
            f"ERROR: refusing to overwrite {index_path} with an empty blog. "
            f"The existing index lists posts but the vault read returned 0 "
            f"published posts — vault at {vault_path!r} may be missing or unsync'd.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    outputs = {}

    # Per-post pages.
    for post in posts:
        outputs[os.path.join(BLOG_DIR, f"{post['slug']}.html")] = generate_post_page(post)

    # Index: re-splice into the existing file if present (preserve chrome),
    # else generate fresh.
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            outputs[index_path] = splice_index(f.read(), posts)
    else:
        outputs[index_path] = generate_index_page(posts)

    # Sitemap: merge blog URLs into the existing file additively, preserving
    # all non-blog entries (publish_daily.py owns those).
    existing_sitemap = None
    if os.path.exists(SITEMAP_PATH):
        with open(SITEMAP_PATH, "r", encoding="utf-8") as f:
            existing_sitemap = f.read()
    outputs[SITEMAP_PATH] = merge_sitemap(existing_sitemap, posts)

    return posts, outputs


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vault", default=DEFAULT_VAULT,
                    help=f"path to the Obsidian vault (default: {DEFAULT_VAULT})")
    ap.add_argument("--check", action="store_true",
                    help="verify the site is in sync with the source; exit 1 if drifted")
    args = ap.parse_args()

    os.makedirs(BLOG_DIR, exist_ok=True)
    posts, outputs = build(args.vault)

    if args.check:
        drifted = []
        for path, content in outputs.items():
            existing = None
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    existing = f.read()
            if existing != content:
                drifted.append(path)
        if drifted:
            print("DRIFT: out of sync — run `python3 scripts/build_blog.py`:",
                  file=sys.stderr)
            for p in drifted:
                print(f"  {p}", file=sys.stderr)
            return 1
        print(f"in sync: {len(posts)} published post(s)")
        return 0

    written = 0
    for path, content in outputs.items():
        existing = None
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                existing = f.read()
        if existing == content:
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        written += 1

    print(f"Blog built: {len(posts)} published post(s); {written} file(s) written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
