#!/bin/bash
# deploy-staging.sh — Deploy Sophia AI Factory to STAGING worker.
# Based on deploy-with-sha.sh (PROD) but targets wrangler.staging.toml.
#
# Usage (from anywhere; relocates to apps/sophia-ai-factory/):
#   bash scripts/deploy-staging.sh
#   npm run deploy:staging
#
# Staging URL: https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev
# Created: 2026-05-17 (plan 260517-2223-sophia-free100-handover Phase 02)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"
cd "$APP_DIR"

CFG="wrangler.staging.toml"
WORKER_NAME="sophia-ai-factory-staging"
STAGING_URL="https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev"

retry_cf() {
  local label="$1"; shift
  local attempt=1 max=3 delay=5
  while [ $attempt -le $max ]; do
    if "$@"; then return 0; fi
    if [ $attempt -eq $max ]; then
      echo "❌ $label failed after $max attempts — aborting deploy"
      return 1
    fi
    echo "⚠️  $label failed (attempt $attempt/$max), retrying in ${delay}s..."
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

# Staging is more permissive than PROD — allow unpushed commits for fast iteration.
# Override with STAGING_REQUIRE_PUSH=1 to enforce push-before-deploy in staging.
if [ "${STAGING_REQUIRE_PUSH:-0}" = "1" ]; then
  UNPUSHED=$(git -C "$REPO_ROOT" log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
  if [ "$UNPUSHED" != "0" ]; then
    echo "❌ STAGING_REQUIRE_PUSH=1 set but $UNPUSHED commit(s) unpushed."
    exit 2
  fi
fi

COMMIT_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
COMMIT_SHORT=$(echo "$COMMIT_SHA" | cut -c1-8)
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOY_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)

echo "Deploying STAGING ($WORKER_NAME) at SHA $COMMIT_SHORT (branch: $DEPLOY_BRANCH)"

echo "==> generate-supabase-migrations-manifest"
node scripts/generate-supabase-migrations-manifest.mjs

echo "==> npm run build"
npm run build

echo "==> fix-instrumentation-standalone"
node scripts/fix-instrumentation-standalone.mjs

echo "==> opennextjs/cloudflare build"
npx @opennextjs/cloudflare build --skipNextBuild

echo "==> inject-scheduled-handler"
node scripts/inject-scheduled-handler.mjs

echo "==> Setting STAGING Worker secrets (COMMIT_SHA, DEPLOYED_AT, DEPLOY_BRANCH)"
retry_cf "secret put COMMIT_SHA"    bash -c "echo '$COMMIT_SHA'    | npx wrangler secret put COMMIT_SHA    --config $CFG --name $WORKER_NAME"
retry_cf "secret put DEPLOYED_AT"   bash -c "echo '$DEPLOYED_AT'   | npx wrangler secret put DEPLOYED_AT   --config $CFG --name $WORKER_NAME"
retry_cf "secret put DEPLOY_BRANCH" bash -c "echo '$DEPLOY_BRANCH' | npx wrangler secret put DEPLOY_BRANCH --config $CFG --name $WORKER_NAME"

echo "==> wrangler deploy (staging)"
retry_cf "wrangler deploy staging" npx wrangler deploy --config "$CFG"

echo ""
echo "✅ STAGING deploy complete."
echo "URL:    $STAGING_URL"
echo "Verify: curl -s $STAGING_URL/api/version"
