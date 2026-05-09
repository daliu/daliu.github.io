#!/usr/bin/env bash
# Regenerate resume.pdf from index.html via headless Chrome.
# Run from the repo root: ./resume/regenerate.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

if [[ ! -x "$CHROME" ]]; then
  echo "Chrome not found at $CHROME — install or adjust path"
  exit 1
fi

# Start a local server so the page loads with absolute asset paths working.
python3 -m http.server 8765 --bind 127.0.0.1 -d "$REPO_ROOT" >/dev/null 2>&1 &
SPID=$!
trap "kill $SPID 2>/dev/null || true" EXIT
sleep 1.5

"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --no-pdf-header-footer \
  --virtual-time-budget=4000 \
  --print-to-pdf="$REPO_ROOT/resume/resume.pdf" \
  "http://127.0.0.1:8765/resume/" 2>&1 | tail -3

echo "Wrote $REPO_ROOT/resume/resume.pdf"
ls -la "$REPO_ROOT/resume/resume.pdf"
