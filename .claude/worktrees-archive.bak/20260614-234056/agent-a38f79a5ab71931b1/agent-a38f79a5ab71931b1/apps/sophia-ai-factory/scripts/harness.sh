#!/usr/bin/env bash
# scripts/harness.sh — Unified Sophia AI Factory quality gate + deploy harness
#
# Usage:
#   ./scripts/harness.sh              # Full pipeline: typecheck → test → build → deploy → verify
#   ./scripts/harness.sh typecheck    # TypeScript gate only
#   ./scripts/harness.sh test         # Test gate only
#   ./scripts/harness.sh build        # Build gate only
#   ./scripts/harness.sh deploy       # Build + deploy (skips typecheck/test)
#   ./scripts/harness.sh verify       # Post-deploy SHA + HTTP check
#   ./scripts/harness.sh ci           # typecheck + test + build (no deploy)
#
# Exit codes:
#   0 — all gates passed
#   1 — gate failure
#   2 — pre-flight failure (dirty tree, unpushed, etc.)
#
# Env overrides:
#   SKIP_TSC=1          Skip type-check gate
#   SKIP_TESTS=1        Skip test gate
#   SKIP_BUILD=1        Skip build gate
#   SKIP_DEPLOY=1       Skip deploy (run gates only)
#   SKIP_MIGRATIONS=1   Skip D1 migration apply
#   ALLOW_UNPUSHED=1    Bypass push precondition
#   DRY_RUN=1           Print what would run, don't execute

set -euo pipefail

# ─── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[info]${NC}  $*"; }
pass()  { echo -e "${GREEN}[pass]${NC}  $*"; }
fail()  { echo -e "${RED}[fail]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }

# ─── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"
cd "$APP_DIR"

# ─── Config ────────────────────────────────────────────────────────────────
PROD_URL="${PROD_URL:-https://sophia.agencyos.network}"
VERSION_URL="${VERSION_URL:-$PROD_URL/api/version}"
COMMIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
COMMIT_SHORT="$(echo "$COMMIT_SHA" | cut -c1-8)"
DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DEPLOY_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
GATE_START=0
GATE_PASS=0
GATE_FAIL=0

# ─── Helpers ───────────────────────────────────────────────────────────────
run() {
  if [ "${DRY_RUN:-0}" = "1" ]; then
    info "DRY RUN: $*"
    return 0
  fi
  info "→ $*"
  # Detect env-prefixed commands (e.g. NODE_OPTIONS=... cmd)
  if [ $# -ge 2 ] && echo "$1" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*='; then
    env "$@"
  else
    "$@"
  fi
}

fetch_url() {
  curl -fsS "$1" 2>/dev/null || curl --noproxy '*' -fsS "$1" 2>/dev/null
}

fetch_status() {
  curl -sSL -o /dev/null -w "%{http_code}" "$1" 2>/dev/null || \
  curl --noproxy '*' -sSL -o /dev/null -w "%{http_code}" "$1" 2>/dev/null
}

extract_short_sha() {
  node -e "let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(input);if(typeof p.shortSha==='string')process.stdout.write(p.shortSha)}catch{}})"
}

cache_bust_url() {
  local url="$1" nonce="$2"
  case "$url" in *\?*) printf '%s&deployVerify=%s' "$url" "$nonce" ;; *) printf '%s?deployVerify=%s' "$url" "$nonce" ;; esac
}

# ─── Pre-flight ────────────────────────────────────────────────────────────
preflight() {
  info "═══ Pre-flight checks ═══"

  # Push precondition
  if [ "${ALLOW_UNPUSHED:-0}" != "1" ]; then
    UNPUSHED=$(git -C "$REPO_ROOT" log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
    if [ "$UNPUSHED" != "0" ]; then
      fail "$UNPUSHED commit(s) ahead of origin/main — push first or ALLOW_UNPUSHED=1"
      return 2
    fi

    git -C "$REPO_ROOT" update-index --refresh > /dev/null 2>&1 || true
    STATUS_PORCELAIN=$(git -C "$REPO_ROOT" status --porcelain | grep -vE '^[? ][?MD ] \.cleo(/)?$' || true)
    if [ -n "$STATUS_PORCELAIN" ]; then
      fail "Dirty working tree. Commit or stash first."
      echo "$STATUS_PORCELAIN" | sed -n '1,10p'
      return 2
    fi
    if ! git -C "$REPO_ROOT" diff-index --quiet HEAD --; then
      fail "Uncommitted changes in working tree."
      return 2
    fi
    UNTRACKED=$(git -C "$REPO_ROOT" ls-files --others --exclude-standard | grep -vE '^\.cleo(/)?$' || true)
    if [ -n "$UNTRACKED" ]; then
      fail "Untracked files in working tree."
      echo "$UNTRACKED" | sed -n '1,10p'
      return 2
    fi
  fi
  pass "Pre-flight: clean"
  return 0
}

# ─── Gate: Type-check ──────────────────────────────────────────────────────
gate_typecheck() {
  GATE_START=$((GATE_START + 1))
  info "═══ Gate ${GATE_START}: TypeScript (tsc --noEmit) ═══"
  if [ "${SKIP_TSC:-0}" = "1" ]; then
    warn "SKIP_TSC=1 — bypassing type-check"
    return 0
  fi
  if run npm run type-check; then
    pass "Type-check: 0 errors"
    GATE_PASS=$((GATE_PASS + 1))
    return 0
  else
    fail "Type-check: ERRORS"
    GATE_FAIL=$((GATE_FAIL + 1))
    return 1
  fi
}

# ─── Gate: Tests ───────────────────────────────────────────────────────────
gate_tests() {
  GATE_START=$((GATE_START + 1))
  info "═══ Gate ${GATE_START}: Tests (vitest) ═══"
  if [ "${SKIP_TESTS:-0}" = "1" ]; then
    warn "SKIP_TESTS=1 — bypassing test gate"
    return 0
  fi
  if run npm test; then
    pass "Tests: all passed"
    GATE_PASS=$((GATE_PASS + 1))
    return 0
  else
    fail "Tests: FAILURES"
    GATE_FAIL=$((GATE_FAIL + 1))
    return 1
  fi
}

# ─── Gate: Build ───────────────────────────────────────────────────────────
gate_build() {
  GATE_START=$((GATE_START + 1))
  info "═══ Gate ${GATE_START}: Build (next build) ═══"
  if [ "${SKIP_BUILD:-0}" = "1" ]; then
    warn "SKIP_BUILD=1 — bypassing build gate"
    return 0
  fi
  info "→ NODE_OPTIONS=--max-old-space-size=4096 npx next build"
  if env NODE_OPTIONS=--max-old-space-size=4096 npx next build; then
    pass "Build: compiled successfully"
    GATE_PASS=$((GATE_PASS + 1))
    return 0
  else
    fail "Build: FAILED"
    GATE_FAIL=$((GATE_FAIL + 1))
    return 1
  fi
}

# ─── Step: D1 Migrations ──────────────────────────────────────────────────
apply_migrations() {
  if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
    warn "SKIP_MIGRATIONS=1 — skipping D1 migration apply"
    return 0
  fi
  if [ "${DRY_RUN:-0}" = "1" ]; then
    info "DRY RUN: bash scripts/apply-migrations.sh"
    return 0
  fi
  info "═══ Apply D1 migrations ═══"
  PREV_LIVE_SHA=""
  PREV_VERSION_JSON=$(fetch_url "$(cache_bust_url "$VERSION_URL" "pre-${COMMIT_SHORT}-$(date +%s)")" || true)
  PREV_LIVE_SHA=$(printf '%s' "$PREV_VERSION_JSON" | extract_short_sha || true)

  if [ -n "$PREV_LIVE_SHA" ] && git -C "$REPO_ROOT" rev-parse --verify "$PREV_LIVE_SHA^{commit}" >/dev/null 2>&1; then
    info "Previous live SHA: $PREV_LIVE_SHA — applying migrations since then"
    bash scripts/apply-migrations.sh "$PREV_LIVE_SHA"
  elif [ -n "$PREV_LIVE_SHA" ]; then
    warn "Previous live SHA $PREV_LIVE_SHA not in local reflog — applying all pending"
    bash scripts/apply-migrations.sh
  else
    warn "No previous live SHA found — applying all pending migrations"
    bash scripts/apply-migrations.sh
  fi
}

# ─── Step: Deploy ──────────────────────────────────────────────────────────
step_deploy() {
  info "═══ Deploy (CF-direct) ═══"

  # Generate migrations manifest
  info "→ generate-supabase-migrations-manifest"
  run node scripts/generate-supabase-migrations-manifest.mjs

  # Inject OpenNext version
  RESOLVED_OPENNEXT=$(node -e "const fs=require('fs');const p=require('path').join(process.cwd(),'node_modules','@opennextjs','cloudflare','package.json');console.log(fs.existsSync(p)?p:'')")
  if [ -n "$RESOLVED_OPENNEXT" ]; then
    OPENNEXT_VER=$(node -p "require('${RESOLVED_OPENNEXT}').version")
    if grep -q 'OPENNEXT_VERSION = "' wrangler.toml 2>/dev/null; then
      info "→ Injecting OPENNEXT_VERSION=$OPENNEXT_VER"
      node -e "const fs=require('fs');const f=process.argv[1];const v=process.argv[2];fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/OPENNEXT_VERSION = \"[^\"]*\"/,'OPENNEXT_VERSION = \"'+v+'\"'));" wrangler.toml "$OPENNEXT_VER"
    fi
  fi

  # Strip SSR bloat
  info "→ strip-ssr-bloat"
  run bash scripts/strip-ssr-bloat.sh

  # Fix instrumentation
  info "→ fix-instrumentation-standalone"
  run node scripts/fix-instrumentation-standalone.mjs

  # OpenNext build
  info "→ opennextjs/cloudflare build"
  run npx @opennextjs/cloudflare build --skipNextBuild --noMinify

  # Inject scheduled handler
  info "→ inject-scheduled-handler"
  run node scripts/inject-scheduled-handler.mjs

  # Apply migrations before replacing worker
  apply_migrations

  # Deploy
  info "→ opennextjs-cloudflare deploy"
  if run npx opennextjs-cloudflare deploy --config wrangler.toml; then
    pass "Deploy: worker uploaded"
  else
    fail "Deploy: FAILED"
    return 1
  fi

  # Inject secrets
  info "→ Setting Worker secrets"
  run bash -c "echo '$COMMIT_SHA' | npx wrangler secret put COMMIT_SHA"
  run bash -c "echo '$DEPLOYED_AT' | npx wrangler secret put DEPLOYED_AT"
  run bash -c "echo '$DEPLOY_BRANCH' | npx wrangler secret put DEPLOY_BRANCH"

  # Sentry sourcemaps (non-fatal)
  if [ -x scripts/ci/sentry-upload-sourcemaps.sh ]; then
    bash scripts/ci/sentry-upload-sourcemaps.sh || warn "Sentry sourcemap upload failed (non-fatal)"
  fi
}

# ─── Step: Verify ──────────────────────────────────────────────────────────
step_verify() {
  info "═══ Post-deploy verification ═══"

  # SHA match
  info "→ SHA match check"
  VERIFY_URL="$(cache_bust_url "$VERSION_URL" "sha-${COMMIT_SHORT}-$(date +%s)")"
  LIVE_SHA=""
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    VERSION_JSON=$(fetch_url "$VERIFY_URL" || true)
    LIVE_SHA=$(printf '%s' "$VERSION_JSON" | extract_short_sha || true)
    if [ "$LIVE_SHA" = "$COMMIT_SHORT" ]; then
      pass "SHA match: $LIVE_SHA"
      break
    fi
    warn "Attempt $attempt/12: local=$COMMIT_SHORT live=${LIVE_SHA:-missing}"
    sleep 5
  done
  if [ "$LIVE_SHA" != "$COMMIT_SHORT" ]; then
    fail "SHA mismatch: local=$COMMIT_SHORT live=${LIVE_SHA:-missing}"
    return 1
  fi

  # HTTP check
  info "→ Production HTTP check"
  HTTP_STATUS=$(fetch_status "$PROD_URL" || true)
  if [ "$HTTP_STATUS" = "200" ]; then
    pass "Production HTTP: $HTTP_STATUS"
  else
    fail "Production HTTP: ${HTTP_STATUS:-curl-error}"
    return 1
  fi
}

# ─── Report ────────────────────────────────────────────────────────────────
report() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Harness Report"
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Commit:    $COMMIT_SHORT ($COMMIT_SHA)"
  echo "  Branch:    $DEPLOY_BRANCH"
  echo "  Deployed:  $DEPLOYED_AT"
  echo "  Gates:     $GATE_PASS passed, $GATE_FAIL failed"
  if [ "$GATE_FAIL" -eq 0 ]; then
    echo "  Status:    ✅ GREEN"
  else
    echo "  Status:    ❌ RED ($GATE_FAIL gate(s) failed)"
  fi
  echo "═══════════════════════════════════════════════════════════════"
}

# ─── Pipelines ─────────────────────────────────────────────────────────────
pipeline_full() {
  preflight || return $?
  gate_typecheck || return $?
  gate_tests    || return $?
  gate_build    || return $?
  step_deploy   || return $?
  step_verify   || return $?
  report
  return 0
}

pipeline_ci() {
  preflight || return $?
  gate_typecheck || return $?
  gate_tests    || return $?
  gate_build    || return $?
  report
  return 0
}

pipeline_deploy() {
  preflight || return $?
  gate_build  || return $?
  step_deploy || return $?
  step_verify || return $?
  report
  return 0
}

# ─── Dispatch ──────────────────────────────────────────────────────────────
case "${1:-full}" in
  typecheck)  gate_typecheck; report ;;
  test)       gate_tests;    report ;;
  build)      gate_build;    report ;;
  deploy)     pipeline_deploy ;;
  verify)     step_verify;   report ;;
  ci)         pipeline_ci ;;
  full|"")    pipeline_full ;;
  *)
    echo "Usage: $0 [full|ci|deploy|typecheck|test|build|verify]"
    echo ""
    echo "Pipelines:"
    echo "  full       typecheck → test → build → deploy → verify  (default)"
    echo "  ci         typecheck → test → build                     (no deploy)"
    echo "  deploy     build → deploy → verify                      (skip gates)"
    echo ""
    echo "Single gates:"
    echo "  typecheck  Run tsc --noEmit only"
    echo "  test       Run vitest only"
    echo "  build      Run next build only"
    echo "  verify     Post-deploy SHA + HTTP check only"
    echo ""
    echo "Env: SKIP_TSC=1 SKIP_TESTS=1 SKIP_BUILD=1 SKIP_DEPLOY=1 SKIP_MIGRATIONS=1 ALLOW_UNPUSHED=1 DRY_RUN=1"
    exit 1
    ;;
esac
