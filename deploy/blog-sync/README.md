# Blog sync (local launchd job)

The blog source lives in the Obsidian vault (`~/Documents/Remote Vault/wiki/blog/`),
which only exists on the owner's Mac. A GitHub Action runner has no vault, so the
blog sync **must run locally**, exactly like `~/scripts/sync-knowledge-graph.sh`.

These two files are kept here **for code review**. Their real install paths are
elsewhere on the machine (a web repo isn't the natural home for a shell script +
launchd plist). They mirror the iCloud-vault-materialization + overwrite-guard
semantics of the knowledge-graph sync.

| Repo copy (review)                          | Real install path                                          |
| ------------------------------------------- | ---------------------------------------------------------- |
| `deploy/blog-sync/sync-blog.sh`             | `~/scripts/sync-blog.sh`                                    |
| `deploy/blog-sync/com.daveliu.sync-blog.plist` | `~/Library/LaunchAgents/com.daveliu.sync-blog.plist`    |

## What it does

`sync-blog.sh`:
1. `brctl download`s the vault and waits (≤180s) until `wiki/blog/*.md` is readable
   (handles iCloud dataless placeholders at cron time).
2. Runs `python3 scripts/build_blog.py --vault "$VAULT"`. The overwrite-guard in
   that script exits non-zero rather than wiping a populated `blog/index.html` to
   zero posts, so a non-zero exit means "don't push".
3. Commits **only** `blog/` + `sitemap.xml` if changed, then `git push origin master`.

`com.daveliu.sync-blog.plist`: runs the script daily at **20:05** local (5 min
after `sync-knowledge-graph` at 20:00 so the two vault-materializing jobs don't
race on iCloud).

## Enabling it (manual — do AFTER the blog PR is merged to master)

The plist pushes to `master`, so it is intentionally left **unloaded**. After the
PR merges:

```bash
cp deploy/blog-sync/sync-blog.sh ~/scripts/sync-blog.sh
chmod +x ~/scripts/sync-blog.sh
cp deploy/blog-sync/com.daveliu.sync-blog.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.daveliu.sync-blog.plist
```

(The files are already copied to those paths on the owner's machine, but the
launchctl `load` step has deliberately NOT been run.)

## Dependency

`build_blog.py` needs the `markdown` PyPI lib (pinned `markdown>=3.6,<4`):

```bash
python3 -m pip install 'markdown>=3.6,<4'
```
