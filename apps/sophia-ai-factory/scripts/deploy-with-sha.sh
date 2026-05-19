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

# ─── Retry helper for transient CF API failures (502 Bad Gateway, etc) ───────
# 3 attempts with exponential backoff (5s, 10s, 20s). Permanent errors
# (auth, validation, etc) still fail on first attempt — only 5xx and network
# errors merit retry. CF returned 502 Bad Gateway during `secret put` on
# 2026-05-17 (commit c1528012 deploy), leaving deploy half-done. Retry
# eliminates this class of transient failures.
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

# ─── Step 0: Push precondition (2026-05-15 — prevent prod/git divergence) ────
# Reject deploy if local HEAD has commits not yet on origin/main. Latent divergence
# is the root cause of incident 2026-05-13/15 where prod ran code that existed
# only in the deployer's local reflog. See plans/260515-0830-gap-91to93/phase-01.
# Emergency bypass: ALLOW_UNPUSHED_DEPLOY=1 npm run deploy:full
if [ "${ALLOW_UNPUSHED_DEPLOY:-0}" != "1" ]; then
  UNPUSHED=$(git -C "$REPO_ROOT" log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
  if [ "$UNPUSHED" != "0" ]; then
    echo "❌ Refusing to deploy: $UNPUSHED commit(s) on HEAD but not on origin/main."
    echo "Run: git push origin main && git push gitlab main"
    echo "Emergency bypass: ALLOW_UNPUSHED_DEPLOY=1 npm run deploy:full"
    exit 2
  fi
  # Refresh git index before diff check — git caches stat info (mtime/size) per file
  # and treats post-build artifacts with unchanged content as "modified" until the
  # index is refreshed. Without this, a freshly-built tree (where Next.js/OpenNext
  # touched files) reports false-positive uncommitted changes. Cheap (<1s), safe.
  git -C "$REPO_ROOT" update-index --refresh > /dev/null 2>&1 || true
  if ! git -C "$REPO_ROOT" diff-index --quiet HEAD --; then
    echo "❌ Refusing to deploy: uncommitted changes in working tree."
    echo "Affected files:"
    git -C "$REPO_ROOT" diff-index --name-only HEAD -- | head -10
    echo "Commit or stash first."
    exit 2
  fi
  echo "✅ Push precondition: HEAD == origin/main, working tree clean"
fi

# Collect version metadata from git
COMMIT_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
COMMIT_SHORT=$(echo "$COMMIT_SHA" | cut -c1-8)
# Use macOS-compatible date (no GNU-specific flags)
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOY_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)

echo "Deploying SHA $COMMIT_SHORT (branch: $DEPLOY_BRANCH)"
echo "Deployed at: $DEPLOYED_AT"

# ─── Step 0: Generate Supabase migrations manifest (baked into build) ────────
echo "==> generate-supabase-migrations-manifest"
node scripts/generate-supabase-migrations-manifest.mjs

# ─── Step 1: Next.js build ───────────────────────────────────────────────────
# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
# Wave 17 Phase 03: flip distribute gate — set before next build so the literal "1"
# is substituted into the client bundle (wrangler [vars] does NOT do this at runtime).
export NEXT_PUBLIC_DISTRIBUTE_ENABLED=1
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
retry_cf "secret put COMMIT_SHA"   bash -c "echo '$COMMIT_SHA' | npx wrangler secret put COMMIT_SHA"
retry_cf "secret put DEPLOYED_AT"  bash -c "echo '$DEPLOYED_AT' | npx wrangler secret put DEPLOYED_AT"
retry_cf "secret put DEPLOY_BRANCH" bash -c "echo '$DEPLOY_BRANCH' | npx wrangler secret put DEPLOY_BRANCH"

# ─── Step 3b: Pre-deploy E2E smoke (opt-in, Phase 03 Track C) ───────────────
# Gate: RUN_PREDEPLOY_E2E=1 ./scripts/deploy-with-sha.sh
# Runs the @smoke suite against a running local dev server (must be already up
# on http://localhost:3000). Disabled by default so existing deploy flow is
# unchanged for operators who have not started a local server.
if [ "${RUN_PREDEPLOY_E2E:-0}" = "1" ]; then
  echo "[deploy] Pre-deploy E2E smoke (localhost:3000)..."
  PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npx playwright test --grep "@smoke" || {
    echo "[deploy] ❌ Pre-deploy smoke FAILED — aborting deploy"
    exit 3
  }
  echo "[deploy] ✅ Pre-deploy smoke passed"
fi

# ─── Step 4: Deploy ─────────────────────────────────────────────────────────
# IMPORTANT: explicit `--config wrangler.toml` is required for OpenNext's
# deploy hook (wrangler auto-detects opennext projects and delegates to
# `@opennextjs/cloudflare deploy`, which reads its OWN config via
# retrieveCompiledConfig — without the flag it may miss bindings declared in
# wrangler.toml such as NEXT_TAG_CACHE_D1, BACKUPS_BUCKET, VIDEO_BUCKET).
# Verified Phase 5.1 (2026-05-13): without --config, populate-cache errors
# "No D1 binding NEXT_TAG_CACHE_D1 found"; with --config, all bindings resolve.
echo "==> OpenNext Cloudflare deploy"
# OpenNext 1.19+ deploys the generated worker from its adapter output.
# Direct wrangler deploy still points at the legacy .open-next/worker.js path.
retry_cf "opennext deploy" npx opennextjs-cloudflare deploy --config wrangler.toml

# ─── Step 5: Upload Sentry source maps (non-fatal) ──────────────────────────
# Bakes symbolicated stack traces into prod errors. Script gracefully skips
# when SENTRY_AUTH_TOKEN is unset. Failure here MUST NOT fail the deploy —
# the worker is already live by this point.
if [ -x scripts/ci/sentry-upload-sourcemaps.sh ]; then
  echo "==> sentry-upload-sourcemaps"
  bash scripts/ci/sentry-upload-sourcemaps.sh || echo "warn: sentry sourcemap upload failed (non-fatal)"
fi

echo ""
echo "Deploy complete."
echo "Verify: curl -s https://sophia.agencyos.network/api/version"

# ─── Step 6: Post-deploy E2E smoke (opt-in, Phase 03 Track C) ───────────────
# Gate: RUN_POSTDEPLOY_E2E=1 ./scripts/deploy-with-sha.sh
# Runs the @smoke suite against PROD after the SHA already verified above.
# SOPHIA_EXPECTED_SHA is passed so the version test asserts the exact new SHA.
# If smoke fails the worker is live but smoke found a regression — operator
# MUST decide rollback manually (see sophia-deploy-verify.md §Rollback).
PROD_URL="${PROD_URL:-https://sophia.agencyos.network}"
if [ "${RUN_POSTDEPLOY_E2E:-0}" = "1" ]; then
  echo "[deploy] Post-deploy smoke vs $PROD_URL..."
  LOCAL_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD | cut -c1-8)
  PLAYWRIGHT_TEST_BASE_URL="$PROD_URL" SOPHIA_EXPECTED_SHA="$LOCAL_SHA" \
    npx playwright test --grep "@smoke" || {
      echo "[deploy] ❌ Post-deploy smoke FAILED (DEPLOY MAY NEED ROLLBACK — see sophia-deploy-verify.md)"
      exit 4
    }
  echo "[deploy] ✅ Post-deploy smoke passed"
fi
