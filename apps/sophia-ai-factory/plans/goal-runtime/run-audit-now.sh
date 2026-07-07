#!/usr/bin/env bash
set -uo pipefail

echo "── Phase 1: Build ──────────────────────────────────────"
BUILD_LOG="plans/goal-runtime/reports/build-audit.log"
BUILD_EXIT=0
if grep -qiE "error TS|build failed" "$BUILD_LOG" 2>/dev/null; then
  BUILD_EXIT=1
fi
BUILD_ERRORS=$(grep -c "error TS" "$BUILD_LOG" 2>/dev/null || echo "0")
echo "  Build: $([ "$BUILD_EXIT" -eq 0 ] && echo '✅ PASS' || echo "❌ FAIL ($BUILD_ERRORS TS errors)")"

echo "── Phase 2: Tests ──────────────────────────────────────"
TEST_LOG="plans/goal-runtime/reports/test-audit.log"
cd apps/sophia-ai-factory
timeout 600 npm test > "$TEST_LOG" 2>&1 || true
TEST_PASS=true
if grep -qiE "failing|FAIL" "$TEST_LOG" 2>/dev/null; then
  TEST_PASS=false
fi
echo "  Tests: $([ "$TEST_PASS" = true ] && echo '✅ PASS' || echo '❌ FAIL')"

echo "── Phase 3: Deploy ─────────────────────────────────────"
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8 || echo "unknown")
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
SHA_MATCH=false
if [[ "$LOCAL_SHA" == "$LIVE_SHA" ]] && [[ "$LOCAL_SHA" != "unknown" ]]; then
  SHA_MATCH=true
fi
echo "  Deploy: $([ "$SHA_MATCH" = true ] && echo "✅ PASS ($LOCAL_SHA)" || echo "❌ FAIL (local=$LOCAL_SHA live=$LIVE_SHA)")"

echo "── Phase 4: i18n ────────────────────────────────────────"
VI_KEYS=$(grep -oE '"[a-zA-Z0-9_]+"\s*:' messages/vi.json | wc -l | tr -d ' ')
EN_KEYS=$(grep -oE '"[a-zA-Z0-9_]+"\s*:' messages/en.json | wc -l | tr -d ' ')
echo "  i18n: VI=$VI_KEYS EN=$EN_KEYS"

echo "── Phase 5: Plan State ──────────────────────────────────"
PENDING=$(jq '[.plans[]?.phases // [] | .[]? | select(.status == "pending")] | length' plans/goal-runtime/goal-manifest.json 2>/dev/null || echo "0")
echo "  Plan state: $([ "$PENDING" -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL ($PENDING phases pending)")"
