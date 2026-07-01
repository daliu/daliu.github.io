# /now/ daily sync wiring (POST-MERGE — do not apply until this PR is merged)

The `/now/` page is generated from `wiki/now.md` in the Obsidian vault by
`scripts/build_now.py`. Like the knowledge graph and system-status builds, it
must run **locally** on Dave's Mac (the vault is iCloud-backed and Mac-only — a
GitHub Actions runner has no vault), so it joins the existing daily job at
`~/scripts/sync-knowledge-graph.sh`.

**Why this isn't wired up in this PR:** `scripts/build_now.py` does not exist on
`master` until this PR merges. Editing the live `~/scripts/sync-knowledge-graph.sh`
now would make the daily cron try to run a script that isn't there yet and fail.
So the change below is documented here and in the PR body; **apply it after
merge.**

## Prerequisite

The `markdown` library must be importable by the same `python3` the sync uses:

```bash
python3 -c "import markdown; print(markdown.__version__)"
# if missing:
python3 -m pip install "markdown>=3.6,<4"
```

(This is the same dependency the blog PR introduces; if that's already merged and
installed, nothing more is needed.)

## The exact edit to `~/scripts/sync-knowledge-graph.sh`

The vault is already materialized earlier in the script (the `brctl download` +
wait loop), so `build_now.py` can run right after `build_status.py`.

1. **Add the build step** — after the `build_status.py` block, before the
   `git diff --quiet` check:

   ```bash
   # Build the /now/ page from wiki/now.md (needs the materialized vault)
   python3 "$REPO/scripts/build_now.py" --vault "$VAULT" >> "$LOG" 2>&1
   if [ $? -ne 0 ]; then
       echo "[$DATE] ERROR: build_now.py failed" >> "$LOG"
       exit 1
   fi
   ```

   `build_now.py` has its own overwrite guard (it refuses to render when
   `wiki/now.md` is empty/section-less), mirroring `build_graph.py`, so a sparse
   vault can't blank the page. It's also idempotent: no change to `now.md` → no
   write → nothing to commit.

2. **Include `now/index.html` in the change check** — replace:

   ```bash
   if git diff --quiet knowledge/graph-data.json status/data.json 2>/dev/null; then
   ```

   with:

   ```bash
   if git diff --quiet knowledge/graph-data.json status/data.json now/index.html 2>/dev/null; then
   ```

3. **Include it in the commit's `git add`** — replace:

   ```bash
   git add knowledge/graph-data.json status/data.json
   ```

   with:

   ```bash
   git add knowledge/graph-data.json status/data.json now/index.html
   ```

   (Keep the commit narrowly scoped to the generated files, as the existing
   script does — never sweep in unrelated edits.)

## How Dave edits /now/ going forward

Edit `wiki/now.md` in the vault and bump the `updated:` frontmatter date (that
date drives the "Last updated" line). The next daily sync re-renders
`now/index.html` and pushes it. To preview locally before the sync runs:

```bash
python3 ~/Code/daliu.github.io/scripts/build_now.py     # writes now/index.html
python3 ~/Code/daliu.github.io/scripts/build_now.py --check   # exit 1 if drifted
```
