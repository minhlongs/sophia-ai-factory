#!/bin/bash
# feature-smoke-phase2.sh — Phase 2 (Creative Intelligence) production smoke checks.
#
# Asserts the Phase 2 surface behaves as designed BEFORE any data exists:
#   1. New graph read routes reject unauthenticated requests with 401
#      (proves route deployed + auth gate active, per plan §5.7).
#   2. /api/version echoes the expected deploy SHA helper output
#      (SHA-match verification, same signal as verify-production-deploy.sh).
#
# Exit codes: 0 = green, 1 = one or more assertions failed, 2 = usage error.
#
# Usage:
#   bash scripts/feature-smoke-phase2.sh [PROD_URL] [EXPECTED_SHA_8CHAR]
#
# Env overrides: PROD_URL, EXPECTED_SHA (same defaults logic as below).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

PROD_URL="${1:-${PROD_URL:-https://sophia.agencyos.network}}"
EXPECTED_SHA="${2:-${EXPECTED_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD | cut -c1-8)}}"

echo "==> feature-smoke-phase2"
echo "Production:   $PROD_URL"
echo "Expected SHA: $EXPECTED_SHA"
echo ""

FAILURES=0

# ── Helper: assert a URL returns exactly the expected HTTP status ────────────
assert_status() {
  local name="$1" url="$2" want="$3" allow503="${4:-}"
  local got
  got="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url")" || {
    echo "❌ $name: curl failed ($url)"
    FAILURES=$((FAILURES + 1))
    return
  }
  if [ "$got" = "$want" ]; then
    echo "✅ $name: $got (as expected)"
  elif [ -n "$allow503" ] && [ "$got" = "503" ]; then
    # IPN webhook canary window is KNOWN-BY-DESIGN (deploy-verify rule);
    # never a rollback cause. Kept here for parity with plan R8 posture.
    echo "⚠️  $name: $got (known-by-design canary window, accepted)"
  else
    echo "❌ $name: got $got, want $want ($url)"
    FAILURES=$((FAILURES + 1))
  fi
}

# ── 1. Graph routes → 401 unauthenticated (route exists + auth gate) ─────────
assert_status "GET /api/graphs/ip-lineage (unauth)" \
  "$PROD_URL/api/graphs/ip-lineage?workspaceId=smoke&ipId=smoke" 401
assert_status "GET /api/graphs/content-lineage (unauth)" \
  "$PROD_URL/api/graphs/content-lineage?workspaceId=smoke&projectId=smoke" 401
assert_status "GET /api/graphs/projects (unauth)" \
  "$PROD_URL/api/graphs/projects?workspaceId=smoke" 401

# Unknown graph type must NOT leak stack traces to unauth callers either.
assert_status "GET /api/graphs/<unknown-type> (unauth)" \
  "$PROD_URL/api/graphs/not-a-real-type" 401

# ── 2. Version endpoint: SHA echo helper ─────────────────────────────────────
VERSION_JSON="$(curl -sS --max-time 20 "$PROD_URL/api/version")" || VERSION_JSON=""
LIVE_SHA="$(printf '%s' "$VERSION_JSON" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || true)"
if [ -n "$LIVE_SHA" ] && [ "$LIVE_SHA" = "$EXPECTED_SHA" ]; then
  echo "✅ /api/version shortSha matches expected: $LIVE_SHA"
else
  echo "❌ /api/version shortSha mismatch or missing: live='${LIVE_SHA:-<none>}' expected='$EXPECTED_SHA'"
  FAILURES=$((FAILURES + 1))
fi

# ── 3. Baseline service health (context, not Phase-2-specific) ───────────────
HEALTH_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$PROD_URL/api/health")" || HEALTH_STATUS="000"
if [ "$HEALTH_STATUS" = "200" ]; then
  echo "✅ /api/health: 200"
else
  echo "❌ /api/health: $HEALTH_STATUS (want 200)"
  FAILURES=$((FAILURES + 1))
fi

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "RESULT: FAILED ($FAILURES assertion(s) failed)"
  exit 1
fi
echo "RESULT: GREEN — all Phase 2 smoke assertions passed."
