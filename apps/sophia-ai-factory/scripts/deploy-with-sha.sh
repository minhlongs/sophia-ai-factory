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
#
# M1 16GB OOM escape hatches (production default = unset / 0):
#   SKIP_PWA=1            Skip service-worker generation (next-pwa webpack plugin).
#                         Cost: offline mode breaks. Only for local dev.
#   SKIP_RC=1             Disable React Compiler. Cost: lose RC perf opts. Local dev only.
#   SKIP_SENTRY_BUILD=1   Skip Sentry build-time wrap (no source-map upload).
#                         Cost: prod stack traces remain minified. Doctrine allows it
#                         (sourcemaps optional per sophia-no-tech-doctrine.md), but
#                         next.config.ts logs a warning when set during NODE_ENV=production.
#   ALLOW_UNPUSHED_DEPLOY=1   Bypass HEAD-vs-origin/main precondition. Emergency only.
#   SKIP_NEXT_BUILD=1     Reuse an existing .next build artifact. Emergency only:
#                         verify the artifact was built from the same app source.
#
# Build engine note (2026-05-21):
#   `npm run build` uses Turbopack, NOT webpack. This is forced by M1 16GB
#   hardware — webpack's @vercel/nft trace collector OOM-kills during
#   "Collecting build traces" on this codebase even with 14GB Node heap +
#   SKIP_PWA + SKIP_RC + SKIP_SENTRY_BUILD. Tradeoff accepted: webpack-only
#   plugins (@ducanh2912/next-pwa, @next/bundle-analyzer) are silently
#   skipped by Turbopack. PWA service worker generation is NOT happening
#   in this build pipeline — offline mode degraded. @sentry/nextjs v10
#   supports Turbopack natively so source maps still upload when
#   SKIP_SENTRY_BUILD is unset. To restore webpack: bigger build machine
#   or re-enable GitHub Actions CI (.github/workflows/test.yml.disabled).

set -euo pipefail

# Relocate to apps/sophia-ai-factory/ regardless of invocation location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

cd "$APP_DIR"

# ─── Unset proxy for CF API calls (local SOCKS5 proxy breaks wrangler fetch) ──
# NO_PROXY list doesn't include Cloudflare API hosts; clear all proxy vars so
# wrangler/opennext can reach api.cloudflare.com/workers directly.
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy

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

fetch_url() {
  local url="$1"
  curl -fsS "$url" 2>/dev/null || curl --noproxy '*' -fsS "$url" 2>/dev/null
}

fetch_status() {
  local url="$1"
  curl -sSL -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || \
    curl --noproxy '*' -sSL -o /dev/null -w "%{http_code}" "$url" 2>/dev/null
}

cache_bust_url() {
  local url="$1"
  local nonce="$2"
  case "$url" in
    *\?*) printf '%s&deployVerify=%s' "$url" "$nonce" ;;
    *) printf '%s?deployVerify=%s' "$url" "$nonce" ;;
  esac
}

extract_short_sha() {
  node -e "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { try { const parsed = JSON.parse(input); if (typeof parsed.shortSha === 'string') process.stdout.write(parsed.shortSha); } catch {} });"
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
  STATUS_PORCELAIN=$(git -C "$REPO_ROOT" status --porcelain | grep -vE '^[? ][?MD ] \.cleo(/)?$' || true)
  if [ -n "$STATUS_PORCELAIN" ]; then
    echo "❌ Refusing to deploy: git status reports a dirty working tree."
    echo "Affected files:"
    printf '%s\n' "$STATUS_PORCELAIN" | sed -n '1,10p'
    echo "Commit, stash, or ignore generated files first."
    exit 2
  fi
  if ! git -C "$REPO_ROOT" diff-index --quiet HEAD --; then
    echo "❌ Refusing to deploy: uncommitted changes in working tree."
    echo "Affected files:"
    git -C "$REPO_ROOT" diff-index --name-only HEAD -- | head -10
    echo "Commit or stash first."
    exit 2
  fi
  UNTRACKED=$(git -C "$REPO_ROOT" ls-files --others --exclude-standard | grep -vE '^\.cleo(/)?$' || true)
  if [ -n "$UNTRACKED" ]; then
    echo "❌ Refusing to deploy: untracked files in working tree."
    echo "Affected files:"
    printf '%s\n' "$UNTRACKED" | sed -n '1,10p'
    echo "Commit, stash, or ignore generated files first."
    exit 2
  fi
  echo "✅ Push precondition: HEAD == origin/main, working tree clean"
fi

# Collect version metadata from git before any manifest/attestation step uses it.
COMMIT_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
COMMIT_SHORT=$(echo "$COMMIT_SHA" | cut -c1-8)
# Use macOS-compatible date (no GNU-specific flags)
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOY_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
PROD_URL="${PROD_URL:-https://sophia.agencyos.network}"
VERSION_BASE_URL="${VERSION_URL:-$PROD_URL/api/version}"
PREVIOUS_VERSION_URL=$(cache_bust_url "$VERSION_BASE_URL" "pre-${COMMIT_SHORT}-$(date +%s)")
VERIFY_VERSION_URL=$(cache_bust_url "$VERSION_BASE_URL" "sha-${COMMIT_SHORT}")

# Capture the currently deployed SHA before replacing the worker. This is the
# authoritative migration range for CF-direct deploys: any D1 migration changed
# between previous-live and HEAD must be applied before this script may report
# production green.
PREVIOUS_LIVE_SHA=""
PREVIOUS_VERSION_JSON=$(fetch_url "$PREVIOUS_VERSION_URL" || true)
PREVIOUS_LIVE_SHA=$(printf '%s' "$PREVIOUS_VERSION_JSON" | extract_short_sha || true)
if [ -n "$PREVIOUS_LIVE_SHA" ]; then
  echo "Previous live SHA: $PREVIOUS_LIVE_SHA"
else
  echo "⚠️ Could not read previous live SHA from $PREVIOUS_VERSION_URL; deploy will abort before replacing the worker unless SKIP_D1_MIGRATIONS=1"
fi

# ─── Step 0.7: Deploy attestation (SOC 2 CC6.1 — separation-of-duties) ─────
# Audit-mode by default so the canonical CF-direct deploy remains usable.
# Set REQUIRE_DEPLOY_ATTESTATION=1 to enforce at least two distinct operator
# signatures. Emergency bypass remains SKIP_ATTESTATION=1 with documented reason.
if [ "${SKIP_ATTESTATION:-0}" != "1" ]; then
  echo "==> Deploy attestation (separation-of-duties)"

  # Generate deploy manifest
  DIFF_STAT=$(git -C "$REPO_ROOT" diff --stat origin/main...HEAD 2>/dev/null | tail -1 || echo "0 files changed")
  FILES_CHANGED=$(git -C "$REPO_ROOT" diff --name-only origin/main...HEAD 2>/dev/null | wc -l | tr -d ' ')
  OPERATOR_HOST=$(hostname)
  OPERATOR_USER=$(whoami)
  MANIFEST=$(node -e "const [commit_sha,branch,timestamp,operator_host,operator_user,diff_summary,files_changed]=process.argv.slice(1); console.log(JSON.stringify({commit_sha,branch,timestamp,operator_host,operator_user,diff_summary,files_changed:Number(files_changed)}));" "$COMMIT_SHA" "$DEPLOY_BRANCH" "$DEPLOYED_AT" "$OPERATOR_HOST" "$OPERATOR_USER" "$DIFF_STAT" "$FILES_CHANGED")

  echo "Deploy manifest:"
  echo "  $MANIFEST"

  # Require at least two distinct operator attestations
  ATTESTATION_COUNT=0
  for KEY_NUM in 1 2 3 4 5; do
    SECRET_VAR="DEPLOY_KEY_${KEY_NUM}"
    SIGNED_VAR="DEPLOY_ATTESTATION_${KEY_NUM}"
    if [ -n "${!SECRET_VAR:-}" ] && [ -n "${!SIGNED_VAR:-}" ]; then
      EXPECTED=$(printf '%s' "$MANIFEST" | openssl dgst -sha256 -hmac "${!SECRET_VAR}" 2>/dev/null | awk '{print $NF}')
      if [ "$EXPECTED" = "${!SIGNED_VAR}" ]; then
        echo "  ✅ Attestation ${KEY_NUM} verified (operator key ${KEY_NUM})"
        ATTESTATION_COUNT=$((ATTESTATION_COUNT + 1))
      else
        echo "  ❌ Attestation ${KEY_NUM} INVALID — signature mismatch"
        echo "  Bypass: SKIP_ATTESTATION=1 ./scripts/deploy-with-sha.sh (emergency only — document reason)"
        exit 2
      fi
    fi
  done

  if [ "$ATTESTATION_COUNT" -lt 2 ]; then
    if [ "${REQUIRE_DEPLOY_ATTESTATION:-0}" = "1" ]; then
      echo "❌ Deploy requires at least 2 operator attestations (found ${ATTESTATION_COUNT})"
      echo "Setup: export DEPLOY_KEY_1=<key> DEPLOY_ATTESTATION_1=<sig> DEPLOY_KEY_2=<key> DEPLOY_ATTESTATION_2=<sig>"
      echo "Bypass: SKIP_ATTESTATION=1 ./scripts/deploy-with-sha.sh (emergency only — document reason)"
      exit 2
    fi
    echo "⚠️ Deploy attestation audit: ${ATTESTATION_COUNT}/2 signatures verified"
    echo "⚠️ Set REQUIRE_DEPLOY_ATTESTATION=1 to enforce separation-of-duties"
  else
    echo "✅ Attestation passed: ${ATTESTATION_COUNT} operator(s) signed"
  fi
else
  echo "⚠️ SKIP_ATTESTATION=1 — BYPASSING deploy attestation (emergency hotfix)"
  echo "⚠️ Document bypass reason: date, operator, reason, rollback plan"
  echo "⚠️ SOC 2 CC6.1: Re-attest within 24h or next business day"
fi

# ─── Step 0.75: Record deploy audit log entry (SOC 2 immutable audit) ─────────────
# All production deploys must be recorded in raas_audit_logs with hash chain integrity.
# We POST to the internal /api/admin/audit/deploy endpoint which writes the audit entry.
# This is non-fatal: if the endpoint fails, the deploy continues (manual backfill possible).
echo "==> Recording deploy audit log entry"
# Build JSON payload for audit log
AUDIT_PAYLOAD=$(node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); const [commit_sha,branch,timestamp,operator_host,operator_user,diff_summary,files_changed]=process.argv.slice(1); console.log(JSON.stringify({event:'DEPLOY',commit_sha,branch,timestamp,operator_host,operator_user,diff_summary,files_changed:Number(files_changed),manifest:{commit_sha,branch,timestamp,operator_host,operator_user,diff_summary,files_changed:Number(files_changed),opennext_version:pkg.dependencies['@opennextjs/cloudflare']?.match(/\\^([0-9.]+)/)?.[1]||'unknown',attestation_count:${ATTESTATION_COUNT},skip_attestation:${SKIP_ATTESTATION:-0},skip_tests:${SKIP_TESTS:-0},skip_tsc:${SKIP_TSC:-0}}));" "$COMMIT_SHA" "$DEPLOY_BRANCH" "$DEPLOYED_AT" "$OPERATOR_HOST" "$OPERATOR_USER" "$DIFF_STAT" "$FILES_CHANGED")
# Fire-and-forget: deploy must not fail if audit endpoint is temporarily unreachable
curl -fsS -X POST "https://sophia.agencyos.network/api/admin/audit/deploy" \
  -H "Content-Type: application/json" \
  -d "$AUDIT_PAYLOAD" 2>/dev/null || echo "⚠️  Deploy audit log POST failed (non-fatal — manual backfill via /admin/audit recommended)"
echo "Deploying SHA $COMMIT_SHORT (branch: $DEPLOY_BRANCH)"
echo "Deployed at: $DEPLOYED_AT"

# ─── Step 0: Generate Supabase migrations manifest (baked into build) ────────
echo "==> generate-supabase-migrations-manifest"
node scripts/generate-supabase-migrations-manifest.mjs

# ─── Step 0.3: Resolve OpenNext version from installed package (not package.json range) ─
# Reads the actual @opennextjs/cloudflare version from node_modules (the exact build artifact
# shipped by `npx @opennextjs/cloudflare build`). Injects into wrangler.toml [vars] so
# /api/version reflects reality instead of a stale hardcoded constant.
RESOLVED_OPENNEXT=$(node -e "const fs=require('fs'); const path=require('path'); const p=path.join(process.cwd(),'node_modules','@opennextjs','cloudflare','package.json'); console.log(fs.existsSync(p)?p:'')")
if [ -n "$RESOLVED_OPENNEXT" ]; then
  OPENNEXT_VER=$(node -p "require('${RESOLVED_OPENNEXT}').version")
  # Only update if wrangler.toml has the placeholder pattern
  if grep -q 'OPENNEXT_VERSION = "' "$APP_DIR/wrangler.toml" 2>/dev/null; then
    echo "==> Injecting OPENNEXT_VERSION=$OPENNEXT_VER into wrangler.toml"
    node -e "const fs=require('fs'); const file=process.argv[1]; const version=process.argv[2]; const src=fs.readFileSync(file,'utf8'); fs.writeFileSync(file,src.replace(/OPENNEXT_VERSION = \"[^\"]*\"/,'OPENNEXT_VERSION = \"'+version+'\"'));" "$APP_DIR/wrangler.toml" "$OPENNEXT_VER"
  fi
else
  echo "⚠️ @opennextjs/cloudflare not in node_modules — OPENNEXT_VERSION stays as wrangler.toml default"
fi

# ─── Step 0.5: TypeScript gate (replaces removed ignoreBuildErrors safety) ───
# next.config.ts has `ignoreBuildErrors: true` to dodge an M1 16GB OOM during
# Next's inner typecheck. We MUST run tsc --noEmit externally before next build
# or type errors silently ship to prod. Non-negotiable since TIER-2A reversal.
if [ "${SKIP_TSC:-0}" != "1" ]; then
  echo "==> npm run type-check (TS gate)"
  npm run type-check
else
  echo "⚠️  SKIP_TSC=1 — bypassing TypeScript gate"
fi

# ─── Step 0.6: Test gate (Wave C C-7, 2026-05-22) ────────────────────────────
# Run vitest suite before deploy. CF-direct doctrine removed GitHub Actions CI
# as the test gate, leaving regressions only catchable manually. Skip with
# SKIP_TESTS=1 for emergency hotfixes (documented in deploy log).
if [ "${SKIP_TESTS:-0}" != "1" ]; then
  echo "==> npm test (pre-deploy test gate)"
  npm test
else
  echo "⚠️  SKIP_TESTS=1 — bypassing test gate (emergency hotfix)"
fi

# ─── Step 0.7: Verify commit signatures (Supply Chain Hardening) ───────────────
# Block deploy if any commits since origin/main are not GPG-signed.
if [ "${SKIP_SIGNATURE_CHECK:-0}" != "1" ]; then
  echo "==> verify commit signatures (GPG)"
  node scripts/supply-chain/verify-signed-commits.mjs || {
    echo "❌ Unsigned commits detected — aborting deploy"
    exit 2
  }
else
  echo "⚠️ SKIP_SIGNATURE_CHECK=1 — bypassing commit signature check"
fi

# ─── Step 1: Next.js build ───────────────────────────────────────────────────
# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
if [ "${SKIP_NEXT_BUILD:-0}" = "1" ]; then
  if [ ! -f .next/BUILD_ID ]; then
    echo "❌ SKIP_NEXT_BUILD=1 but .next/BUILD_ID is missing."
    exit 2
  fi
  echo "⚠️  SKIP_NEXT_BUILD=1 — reusing existing .next build artifact"
else
  echo "==> npm run build"
  npm run build
fi

# ─── Step 1.5: Generate SBOM (Supply Chain Hardening) ──────────────────────
# Create CycloneDX SBOM for traceability. Upload to R2 after deploy succeeds.
if [ "${SKIP_SBOM:-0}" != "1" ]; then
  echo "==> generate SBOM (supply-chain hardening)"
  npm run sbom || {
    echo "❌ SBOM generation failed"
    exit 2
  }
else
  echo "⚠️ SKIP_SBOM=1 — skipping SBOM generation"
fi

# ─── Step 1.5: Strip client-only bloat from SSR chunks ──────────────────────
# Turbopack leaks full client-only libraries (recharts, html2canvas, framer-motion,
# sentry-sdk, etc.) into SSR chunks. Replace them with stubs BEFORE OpenNext's
# esbuild bundles everything into handler.mjs. Without this, the final worker.js
# gzip exceeds the CF Workers 10 MiB limit. Added 2026-05-24.
# IMPORTANT: strip runs AFTER fix-instrumentation-standalone (which creates
# .next/standalone/) so both .next/server/ and .next/standalone/ get stripped.

# ─── Step 2: OpenNext + instrumentation fixes ────────────────────────────────
echo "==> fix-instrumentation-standalone"
node scripts/fix-instrumentation-standalone.mjs

echo "==> strip-ssr-bloat (post-standalone)"
bash scripts/strip-ssr-bloat.sh

echo "==> opennextjs/cloudflare build"
npx @opennextjs/cloudflare build --skipNextBuild --noMinify

echo "==> inject-scheduled-handler"
node scripts/inject-scheduled-handler.mjs

# ─── Step 2.5: Strip bloat from OpenNext output (post-build) ─────────────────
# OpenNext bundles from .next/standalone/ which already has stripped chunks.
# However, esbuild may still include full library code in non-SSR chunks.
# Strip heavy libs from the final .open-next/ output before deploy.
echo "==> strip-ssr-bloat (post-opennext)"
bash scripts/strip-ssr-bloat.sh

# ─── Step 2.5: Post-build strip on OpenNext output ──────────────────────────
# OpenNext bundles .next/standalone into .open-next/server-functions/default/.
# Strip heavy client-only libs from the bundled handler AFTER OpenNext build
# but BEFORE deploy. This reduces the final worker size.
echo "==> strip-ssr-bloat (post-opennext)"
bash scripts/strip-ssr-bloat.sh --post-opennext 2>/dev/null || bash scripts/strip-ssr-bloat.sh

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

# ─── Step 3.7: Apply D1 migrations changed since previous-live SHA ─────────
# SHA/HTTP green is not enough when a deploy includes new D1 migrations. Use
# the live SHA captured before this deploy so multi-commit deploys cannot miss
# migrations that were not in HEAD~1. Apply before replacing the worker so new
# code does not run against an old schema. Emergency bypass: SKIP_D1_MIGRATIONS=1.
if [ "${SKIP_D1_MIGRATIONS:-0}" != "1" ]; then
  if [ -n "$PREVIOUS_LIVE_SHA" ] && git -C "$REPO_ROOT" rev-parse --verify "$PREVIOUS_LIVE_SHA^{commit}" >/dev/null 2>&1; then
    echo "==> apply D1 migrations changed since previous live SHA ($PREVIOUS_LIVE_SHA)"
    bash scripts/apply-migrations.sh "$PREVIOUS_LIVE_SHA"
  elif [ -n "$PREVIOUS_LIVE_SHA" ]; then
    echo "❌ Previous live SHA $PREVIOUS_LIVE_SHA is not present locally; cannot determine D1 migration range"
    echo "Emergency bypass: SKIP_D1_MIGRATIONS=1 npm run deploy:full (document reason)"
    exit 2
  else
    echo "❌ Previous live SHA unavailable; cannot determine D1 migration range"
    echo "Emergency bypass: SKIP_D1_MIGRATIONS=1 npm run deploy:full (document reason)"
    exit 2
  fi
else
  echo "⚠️ SKIP_D1_MIGRATIONS=1 — bypassing D1 migration apply"
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

# ─── Step 4.5: Upload SBOM to R2 ───────────────────────────────────────────────
# Store SBOM in BACKUPS_BUCKET for supply chain artifacts.
if [ "${SKIP_SBOM:-0}" != "1" ]; then
  echo "==> upload SBOM to R2"
  SBOM_FILE=$(ls -t .sbom/sbom-*.json 2>/dev/null | head -1 || true)
  if [ -n "$SBOM_FILE" ] && [ -f "$SBOM_FILE" ]; then
    SBOM_KEY="sbom/$(basename "$SBOM_FILE")"
    echo "  Uploading $SBOM_FILE → s3://$BACKUPS_BUCKET/$SBOM_KEY"
    npx wrangler r2 object put "$BACKUPS_BUCKET" --key "$SBOM_KEY" --file="$SBOM_FILE" --remote || {
      echo "❌ SBOM upload to R2 failed"
      exit 2
    }
    echo "  ✅ SBOM uploaded"
  else
    echo "⚠️ SBOM file not found ($SBOM_FILE); skipping upload"
  fi
fi

# ─── Step 4.5: Inject secrets AFTER deploy ──────────────────────────────────
# Secrets are applied at Worker level; setting them after wrangler deploy
# ensures the running worker version resolves the latest values and circumvents versioning errors.
echo "==> Setting Worker secrets (COMMIT_SHA, DEPLOYED_AT, DEPLOY_BRANCH)"
retry_cf "secret put COMMIT_SHA"   bash -c "echo '$COMMIT_SHA' | npx wrangler secret put COMMIT_SHA"
retry_cf "secret put DEPLOYED_AT"  bash -c "echo '$DEPLOYED_AT' | npx wrangler secret put DEPLOYED_AT"
retry_cf "secret put DEPLOY_BRANCH" bash -c "echo '$DEPLOY_BRANCH' | npx wrangler secret put DEPLOY_BRANCH"

# ─── Step 5: Upload Sentry source maps (fail-fast) ───────────────────────────
# Bakes symbolicated stack traces into prod errors. Script gracefully skips
# when SENTRY_AUTH_TOKEN is unset. Failure here will fail the deploy — we
# want fail-fast on Sentry upload issues to maintain observability guarantees.
if [ -x scripts/ci/sentry-upload-sourcemaps.sh ]; then
  echo "==> sentry-upload-sourcemaps"
  bash scripts/ci/sentry-upload-sourcemaps.sh

  # Post-deploy probe: verify release exists with artifacts
  RELEASE="${SENTRY_RELEASE:-$COMMIT_SHORT}"
  if npx @sentry/cli releases info "$RELEASE" --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" >/dev/null 2>&1; then
    echo "✅ Sentry release $RELEASE verified"
  else
    echo "❌ Sentry release $RELEASE not found or missing artifacts"
    exit 2
  fi
fi

# ─── Step 5.2: Mandatory live deploy verification ──────────────────────────
# HTTP 200 alone can be a stale worker. /api/version must expose the exact
# COMMIT_SHA secret injected above before this deploy can be reported GREEN.
echo "==> verify deployed SHA via $VERIFY_VERSION_URL"
LIVE_SHA=""
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  VERSION_JSON=$(fetch_url "$VERIFY_VERSION_URL" || true)
  LIVE_SHA=$(printf '%s' "$VERSION_JSON" | extract_short_sha || true)
  if [ "$LIVE_SHA" = "$COMMIT_SHORT" ]; then
    echo "✅ Deploy SHA match: $LIVE_SHA"
    break
  fi
  echo "⏳ Deploy SHA not visible yet (attempt $attempt/12): local=$COMMIT_SHORT live=${LIVE_SHA:-missing}"
  sleep 5
done

if [ "$LIVE_SHA" != "$COMMIT_SHORT" ]; then
  echo "❌ Deploy SHA mismatch after propagation wait: local=$COMMIT_SHORT live=${LIVE_SHA:-missing}"
  echo "Version response: ${VERSION_JSON:-<empty>}"
  exit 2
fi

echo "==> verify production HTTP via $PROD_URL"
HTTP_STATUS=$(fetch_status "$PROD_URL" || true)
if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ Production HTTP check failed: ${HTTP_STATUS:-curl-error}"
  exit 2
fi
echo "✅ Production HTTP: $HTTP_STATUS"

echo ""
echo "Deploy complete."
echo "Verified: $VERIFY_VERSION_URL shortSha == $COMMIT_SHORT"

# ─── Step 5.5: Mirror push to gitlab (non-fatal, Wave C P2-5, 2026-05-22) ────
# Best-effort mirror. Local doctrine docs `git push gitlab main` as a manual
# step; auto-pushing here removes operator drift. Non-fatal: a failed mirror
# (network/auth) MUST NOT fail the deploy because the worker is already live.
if git -C "$REPO_ROOT" remote get-url gitlab >/dev/null 2>&1; then
  echo "==> git push gitlab $DEPLOY_BRANCH (non-fatal mirror)"
  git -C "$REPO_ROOT" push gitlab "$DEPLOY_BRANCH" || \
    echo "warn: gitlab mirror push failed (non-fatal; deploy already live)"
fi

# ─── Step 6: Post-deploy E2E smoke (opt-in, Phase 03 Track C) ───────────────
# Gate: RUN_POSTDEPLOY_E2E=1 ./scripts/deploy-with-sha.sh
# Runs the @smoke suite against PROD after the SHA already verified above.
# SOPHIA_EXPECTED_SHA is passed so the version test asserts the exact new SHA.
# If smoke fails the worker is live but smoke found a regression — operator
# MUST decide rollback manually (see sophia-deploy-verify.md §Rollback).
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


