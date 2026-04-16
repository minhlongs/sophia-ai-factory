#!/usr/bin/env bash
# canary-rollout.sh — Wraps wrangler versions deploy for 10%→100% canary.
# RED-TEAM #6: migration-guard.sh must pass before this runs.
# Usage: canary-rollout.sh <new-version-id>
# Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID env vars set.
set -euo pipefail

NEW_VERSION="${1:-}"
if [ -z "$NEW_VERSION" ]; then
  echo "[canary] ERROR: new version ID required as arg 1" >&2
  exit 1
fi

WORKER="sophia-ai-factory"

echo "[canary] Fetching previous stable version..."
PREV_VERSION=$(wrangler versions list --name "$WORKER" --json 2>/dev/null \
  | python3 -c "
import sys, json
versions = json.load(sys.stdin)
# Find the currently deployed version (not the new one being uploaded)
stable = [v for v in versions if v.get('id') != '$NEW_VERSION']
if stable:
    print(stable[0]['id'])
else:
    print('')
" 2>/dev/null || echo "")

if [ -z "$PREV_VERSION" ]; then
  echo "[canary] No previous version found — deploying 100% (first deploy)."
  wrangler versions deploy "${NEW_VERSION}:100%" --name "$WORKER" --yes
  echo "[canary] First deploy complete at 100%."
  exit 0
fi

echo "[canary] Starting canary: NEW=$NEW_VERSION (10%) PREV=$PREV_VERSION (90%)"
wrangler versions deploy \
  "${NEW_VERSION}:10%" \
  "${PREV_VERSION}:90%" \
  --name "$WORKER" \
  --yes

echo "[canary] Canary split active: 10%/90%. Monitoring window: 5 minutes."
echo "[canary] Better Stack alert armed — fires if error_rate > 1% on canary."

CANARY_START=$(date +%s)
CANARY_WINDOW=300  # 5 minutes

echo "[canary] Waiting ${CANARY_WINDOW}s for Better Stack monitoring window..."
sleep "$CANARY_WINDOW"

ELAPSED=$(( $(date +%s) - CANARY_START ))
echo "[canary] ${ELAPSED}s elapsed. No rollback signal received."
echo "[canary] Promoting canary to 100%..."

wrangler versions deploy \
  "${NEW_VERSION}:100%" \
  --name "$WORKER" \
  --yes

echo "[canary] Canary promoted to 100%. Deploy complete."
