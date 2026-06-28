#!/usr/bin/env bash
# canary-rollout.sh — Promotes a freshly-uploaded Worker version to 100%.
# RED-TEAM #6: migration-guard.sh must pass before this runs.
# Usage: canary-rollout.sh <new-version-id>
# Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID env vars set.
#
# YAGNI: 10/90 canary split intentionally removed. Sophia has ~0 customers
# pre-launch; the 5-min canary window adds risk (CF API code 7009 when
# PREV version isn't the active deployment) without protecting any users.
# Re-introduce the split once we have meaningful traffic to monitor.
set -euo pipefail

NEW_VERSION="${1:-}"
if [ -z "$NEW_VERSION" ]; then
  echo "[deploy] ERROR: new version ID required as arg 1" >&2
  exit 1
fi

WORKER="sophia-ai-factory"

echo "[deploy] Promoting NEW=$NEW_VERSION to 100% on $WORKER..."
npx wrangler versions deploy "${NEW_VERSION}:100%" --name "$WORKER" --yes

echo "[deploy] Deploy complete at 100%."
