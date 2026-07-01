#!/bin/bash
# Sync the career blog from the Obsidian vault to daliu.github.io.
#
# Runs daily (launchd) — rebuilds blog/ HTML from wiki/blog/*.md (publish: true
# only) and pushes to GitHub Pages. Mirrors sync-knowledge-graph.sh.
#
# INSTALL PATH (the real location this is run from — NOT the repo copy):
#   ~/scripts/sync-blog.sh
# The copy under the repo (deploy/blog-sync/sync-blog.sh) exists for code review;
# install it with:
#   cp deploy/blog-sync/sync-blog.sh ~/scripts/sync-blog.sh && chmod +x ~/scripts/sync-blog.sh

REPO="$HOME/Code/daliu.github.io"
VAULT="$HOME/Documents/Remote Vault"
LOG="$HOME/scripts/logs/sync-blog.log"
DATE=$(date +"%Y-%m-%d %H:%M")

mkdir -p "$HOME/scripts/logs"

echo "[$DATE] Blog sync starting" >> "$LOG"

# Force-materialize the iCloud-backed Obsidian vault before building.
# At the cron time the vault's files are sometimes evicted to dataless iCloud
# placeholders, so build_blog.py would see 0 posts and the overwrite-guard
# (correctly) refuses — leaving the blog stale. Request download and wait until
# the blog markdown is actually readable. The overwrite-guard in build_blog.py
# remains the safety net if this times out.
echo "[$DATE] Materializing vault at $VAULT ..." >> "$LOG"
brctl download "$VAULT" 2>/dev/null || true   # ask iCloud to fetch (async, best-effort)
DEADLINE=$(( $(date +%s) + 180 ))
while true; do
    # Trigger download-on-open for any dataless files, then count what's present.
    find "$VAULT/wiki/blog" -type f -name "*.md" -exec cat {} + >/dev/null 2>&1
    MD_COUNT=$(find "$VAULT/wiki/blog" -type f -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    if [ "${MD_COUNT:-0}" -ge 1 ]; then
        echo "[$DATE] Vault materialized: $MD_COUNT blog .md file(s) present" >> "$LOG"
        break
    fi
    if [ "$(date +%s)" -ge "$DEADLINE" ]; then
        echo "[$DATE] WARNING: blog source still empty after 180s; proceeding (overwrite-guard will protect)" >> "$LOG"
        break
    fi
    sleep 5
done

cd "$REPO" || { echo "[$DATE] ERROR: repo $REPO missing" >> "$LOG"; exit 1; }

# Build the blog HTML (needs the materialized vault). The overwrite-guard inside
# build_blog.py exits non-zero rather than wiping a populated index to zero, so a
# non-zero exit here means "do not push" — bail without committing.
python3 "$REPO/scripts/build_blog.py" --vault "$VAULT" >> "$LOG" 2>&1
if [ $? -ne 0 ]; then
    echo "[$DATE] ERROR: build_blog.py failed (or overwrite-guard tripped); not pushing" >> "$LOG"
    exit 1
fi

# Check if anything changed (blog HTML or the sitemap blog entries).
if git diff --quiet blog/ sitemap.xml 2>/dev/null && \
   [ -z "$(git status --porcelain blog/ 2>/dev/null)" ]; then
    echo "[$DATE] No blog changes, skipping push" >> "$LOG"
    exit 0
fi

# Commit and push ONLY the blog output + sitemap — never sweep in unrelated edits.
git add blog/ sitemap.xml
git commit -m "Update blog from vault $(date +%Y-%m-%d)" >> "$LOG" 2>&1
git push origin master >> "$LOG" 2>&1

echo "[$DATE] Blog synced and pushed" >> "$LOG"
