#!/bin/bash
# deploy-with-sha.sh — Deploy with COMMIT_SHA/DEPLOYED_AT/DEPLOY_BRANCH secrets injected
# so /api/version returns the actual deployed commit SHA instead of a stale value.
#
# Usage (from repo root or apps/sophia-ai-factory/):
#   ./scripts/deploy-with-sha.sh
#
# Requirements:
#   - wrangler authenticated (npx wrangler whoami should succeed)
#   - CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN env vars, or wrangler.toml auth
#   - Must be run from apps/sophia-ai-factory/ directory or the script relocates automatically

set -euo pipefail

# Relocate to apps/sophia-ai-factory/ regardless of invocation location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

cd "$APP_DIR"

# Collect version metadata from git
COMMIT_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
COMMIT_SHORT=$(echo "$COMMIT_SHA" | cut -c1-8)
# Use macOS-compatible date (no GNU-specific flags)
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOY_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)

echo "Deploying SHA $COMMIT_SHORT (branch: $DEPLOY_BRANCH)"
echo "Deployed at: $DEPLOYED_AT"

# ─── Step 1: Next.js build ───────────────────────────────────────────────────
echo "==> npm run build"
npm run build

# ─── Step 2: OpenNext + instrumentation fixes ────────────────────────────────
echo "==> fix-instrumentation-standalone"
node scripts/fix-instrumentation-standalone.mjs

echo "==> opennextjs/cloudflare build"
npx @opennextjs/cloudflare build --skipNextBuild

echo "==> inject-scheduled-handler"
node scripts/inject-scheduled-handler.mjs

# ─── Step 3: Inject secrets BEFORE deploy ───────────────────────────────────
# Secrets are applied at Worker level; setting them before wrangler deploy
# ensures the running worker sees the new values atomically.
echo "==> Setting Worker secrets (COMMIT_SHA, DEPLOYED_AT, DEPLOY_BRANCH)"
echo "$COMMIT_SHA" | npx wrangler secret put COMMIT_SHA
echo "$DEPLOYED_AT" | npx wrangler secret put DEPLOYED_AT
echo "$DEPLOY_BRANCH" | npx wrangler secret put DEPLOY_BRANCH

# ─── Step 4: Deploy ─────────────────────────────────────────────────────────
echo "==> wrangler deploy"
npx wrangler deploy

echo ""
echo "Deploy complete."
echo "Verify: curl -s https://sophia.agencyos.network/api/version"
