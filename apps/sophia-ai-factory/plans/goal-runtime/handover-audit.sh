#!/usr/bin/env bash
# Goal Runtime: Handover Audit Gate — 6-phase verification
# Usage: handover-audit.sh <app-dir> <reports-dir>
set -euo pipefail

APP_DIR="${1:?Usage: handover-audit.sh <app-dir> <reports-dir>}"
REPORTS_DIR="${2:?Usage: handover-audit.sh <app-dir> <reports-dir>}"
mkdir -p "$REPORTS_DIR"

OVERALL="PASS"
RESULTS="{}"

# ── Phase 1: Build Verification ─────────────────────────────────────
echo "── Phase 1: Build ──────────────────────────────────────"
BUILD_LOG="$REPORTS_DIR/build-audit.log"
cd "$APP_DIR"
BUILD_OUTPUT=$(npm run build 2>&1) || true
echo "$BUILD_OUTPUT" > "$BUILD_LOG"
BUILD_EXIT=0
if echo "$BUILD_OUTPUT" | grep -qi "error\|failed"; then
  BUILD_EXIT=1
  OVERALL="FAIL"
fi
# Count TS errors (look for "error TS" pattern)
BUILD_ERRORS=$(echo "$BUILD_OUTPUT" | grep -c "error TS" || echo "0")
RESULTS=$(echo "$RESULTS" | jq --arg build_exit "$BUILD_EXIT" --argjson build_errors "$BUILD_ERRORS" '. + {build: {pass: ($build_exit == "0"), errors: ($build_errors | tonumber)}}')
echo "  Build: $( [ "$BUILD_EXIT" -eq 0 ] && echo '✅ PASS' || echo "❌ FAIL ($BUILD_ERRORS TS errors)" )"

# ── Phase 2: Tests ──────────────────────────────────────────────────
echo "── Phase 2: Tests ──────────────────────────────────────"
TEST_LOG="$REPORTS_DIR/test-audit.log"
cd "$APP_DIR"
npm test > "$TEST_LOG" 2>&1 || true
TEST_PASS=true
if grep -qE "FAIL|failed" "$TEST_LOG"; then
  TEST_PASS=false
  OVERALL="FAIL"
fi
TOTAL_TESTS=$(grep -oP '\d+(?=\s+passed)' "$TEST_LOG" | tail -1 || echo "?")
PASSED_TESTS="$TOTAL_TESTS"
RESULTS=$(echo "$RESULTS" | jq --arg pass "$TEST_PASS" --argjson total "${TOTAL_TESTS:-0}" --argjson passed "${PASSED_TESTS:-0}" '. + {tests: {pass: ($pass == "true"), total: $total, failed: (($total // 0) - ($passed // 0))}}')
echo "  Tests: $( [ "$TEST_PASS" = true ] && echo "✅ PASS ($PASSED_TESTS passed)" || echo "❌ FAIL" )"

# ── Phase 3: Deploy Verification ────────────────────────────────────
echo "── Phase 3: Deploy ─────────────────────────────────────"
DEPLOY_LOG="$REPORTS_DIR/deploy-audit.log"
SHA_MATCH=false
HTTP_200=false
# SHA match check
LOCAL_SHA=$(cd "$APP_DIR" && git rev-parse HEAD 2>/dev/null | cut -c1-8 || echo "unknown")
LIVE_SHA=$(curl -s "https://sophia.agencyos.network/api/version" 2>/dev/null | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
if [[ "$LOCAL_SHA" == "$LIVE_SHA" ]]; then
  SHA_MATCH=true
  HTTP_200=true
else
  OVERALL="FAIL"
fi
# HTTP check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://sophia.agencyos.network" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  HTTP_200=true
else
  OVERALL="FAIL"
fi
RESULTS=$(echo "$RESULTS" | jq --argjson match "$SHA_MATCH" --argjson http "$HTTP_200" --arg local "$LOCAL_SHA" --arg live "$LIVE_SHA" '. + {deploy: {pass: ($match and $http), sha_match: $match, http_200: $http, local_sha: $local, live_sha: $live}}')
echo "  Deploy: $( [ "$SHA_MATCH" = true ] && echo "✅ PASS (SHA match)" || echo "❌ FAIL (SHA mismatch: local=$LOCAL_SHA live=$LIVE_SHA)" )"

# ── Phase 4: i18n Completeness ──────────────────────────────────────
echo "── Phase 4: i18n ────────────────────────────────────────"
I18N_LOG="$REPORTS_DIR/i18n-audit.log"
I18N_PASS=true
MISSING_VI=0
MISSING_EN=0
# Simple check: both files exist and have similar key counts
VI_KEYS=$(grep -oP '^\s*"[A-Za-z0-9_./]+"' "$APP_DIR/messages/vi.json" 2>/dev/null | wc -l | tr -d ' ')
EN_KEYS=$(grep -oP '^\s*"[A-Za-z0-9_./]+"' "$APP_DIR/messages/en.json" 2>/dev/null | wc -l | tr -d ' ')
DIFF=$((VI_KEYS - EN_KEYS))
if [[ "${DIFF#-}" -gt 10 ]]; then
  I18N_PASS=false
  OVERALL="FAIL"
fi
RESULTS=$(echo "$RESULTS" | jq --arg pass "$I18N_PASS" --argjson vi "$VI_KEYS" --argjson en "$EN_KEYS" '. + {i18n: {pass: ($pass == "true"), vi_keys: $vi, en_keys: $en}}')
echo "  i18n: $( [ "$I18N_PASS" = true ] && echo "✅ PASS (VI=$VI_KEYS EN=$EN_KEYS)" || echo "❌ FAIL (key count mismatch)" )"

# ── Phase 5: Plan State ─────────────────────────────────────────────
echo "── Phase 5: Plan State ──────────────────────────────────"
PLAN_STATE_PASS=true
INCOMPLETE=0
MANIFEST="$APP_DIR/plans/goal-runtime/goal-manifest.json"
if [[ -f "$MANIFEST" ]]; then
  PLAN_COUNT=$(jq '.plans | length' "$MANIFEST")
  PHASE_COUNT=$(jq '[.plans[]?.phases // [] | length] | add // 0' "$MANIFEST")
  # Check for pending phases in goal-manifest
  PENDING=$(jq '[.plans[]?.phases // [] | .[]? | select(.status == "pending")] | length' "$MANIFEST")
  if [[ "$PENDING" -gt 0 ]]; then
    PLAN_STATE_PASS=false
    OVERALL="FAIL"
  fi
else
  PLAN_STATE_PASS="unknown"
fi
RESULTS=$(echo "$RESULTS" | jq --arg pass "$PLAN_STATE_PASS" --argjson incomplete "${PENDING:-0}" '. + {plan_state: {pass: ($pass == "true"), incomplete_phases: $incomplete}}')
echo "  Plan state: $( [ "$PLAN_STATE_PASS" = true ] && echo "✅ PASS ($PHASE_COUNT phases)" || echo "❌ FAIL ($PENDING phases pending)" )"

# ── Write Handover Gate Result ──────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GATE_JSON=$(echo "$RESULTS" | jq --arg ts "$TIMESTAMP" --arg overall "$OVERALL" '{timestamp: $ts, overall: $overall, phases: .}')
GATE_FILE="$REPORTS_DIR/handover-gate.json"
echo "$GATE_JSON" > "$GATE_FILE"

echo ""
echo "════════════════════════════════════════════════════════════"
if [[ "$OVERALL" == "PASS" ]]; then
  echo "│  ✅  HANDOVER GATE: APPROVED                              │"
  echo "│  Sophia AI Factory — ready for CEO handover                │"
else
  echo "│  ❌  HANDOVER GATE: BLOCKED                               │"
  echo "│  Check $GATE_FILE for details                              │"
fi
echo "════════════════════════════════════════════════════════════"

# Exit with appropriate code
[[ "$OVERALL" == "PASS" ]]
