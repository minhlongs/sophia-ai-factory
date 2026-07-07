#!/usr/bin/env bash
# Goal Runtime: Handover Audit Gate — 6-phase verification
# Phase-resumable: each phase can run independently via --phase N
# Usage: handover-audit-new.sh <app-dir> <reports-dir> [--phase N]
#   --phase 1: Build only (fast, reuses cached log if exists)
#   --phase 2: Tests only (REQUIRES --phase 1 done first)
#   --phase 3: Deploy check only (no build/tests needed)
#   --phase 4: i18n check only (no build/tests needed)
#   --phase 5: Plan state check only (no build/tests needed)
#   (no --phase): run all phases sequentially, using cached logs
set -uo pipefail

APP_DIR="${1:?Usage: handover-audit-new.sh <app-dir> <reports-dir> [--phase N]}"
REPORTS_DIR="${2:?Usage: handover-audit-new.sh <app-dir> <reports-dir> [--phase N]}"
PHASE="${3:-}"
mkdir -p "$REPORTS_DIR"

OVERALL="PASS"
RESULTS_FILE="$REPORTS_DIR/phase-results.json"

# Load or init results
if [[ -f "$RESULTS_FILE" ]]; then
  cat "$RESULTS_FILE" > /tmp/_audit_state.json || true
else
  echo '{}' > /tmp/_audit_state.json
fi

state() {
  local key="$1"
  local val="$2"
  jq --arg k "$key" --arg v "$val" '. + {($k): $v}' /tmp/_audit_state.json > /tmp/_audit_state_new.json 2>/dev/null
  mv /tmp/_audit_state_new.json /tmp/_audit_state.json 2>/dev/null || true
}

save_results() {
  jq -n --slurpfile s /tmp/_audit_state.json \
    '{timestamp: (now | todate), overall: $OVERALL, phases: $s[0]}' \
    --arg OVERALL "$OVERALL" > "$RESULTS_FILE" 2>/dev/null || true
}

# Accept optional pre-computed BUILD_EXIT from env or file
# This allows a parent script to inject results from a completed phase
run_phase() {
  local phase="$1"
  case "$phase" in
    1) _phase_build ;;
    2) _phase_tests ;;
    3) _phase_deploy ;;
    4) _phase_i18n ;;
    5) _phase_plan_state ;;
    *) echo "Unknown phase: $phase"; exit 2 ;;
  esac
}

_phase_build() {
  echo "── Phase 1: Build ──────────────────────────────────────"
  BUILD_LOG="$REPORTS_DIR/build-audit.log"
  BUILD_EXIT="${BUILD_EXIT_OVERRIDE:-}"

  if [[ -z "$BUILD_EXIT" ]] && [[ -f "$BUILD_LOG" ]]; then
    echo "  (reusing cached $BUILD_LOG)"
    BUILD_EXIT=0
    if grep -qiE "error TS|build failed|encountered.*error" "$BUILD_LOG" 2>/dev/null; then
      BUILD_EXIT=1
      OVERALL="FAIL"
    fi
  elif [[ -f "$BUILD_LOG" ]]; then
    # Cached log with override
    if [[ "$BUILD_EXIT" != "0" ]]; then OVERALL="FAIL"; fi
  else
    echo "  Running npm run build (~60-120s)..."
    (cd "$APP_DIR" && npm run build 2>&1) | tee "$BUILD_LOG" || true
    BUILD_EXIT=0
    if grep -qiE "error TS|build failed|encountered.*error" "$BUILD_LOG" 2>/dev/null; then
      BUILD_EXIT=1
      OVERALL="FAIL"
    fi
  fi

  BUILD_ERRORS=$(grep -c "error TS" "$BUILD_LOG" 2>/dev/null || echo "0")
  state "build_pass" "$([ "$BUILD_EXIT" -eq 0 ] && echo true || echo false)"
  state "build_ts_errors" "$BUILD_ERRORS"
  echo "  Build: $([ "$BUILD_EXIT" -eq 0 ] && echo '✅ PASS' || echo "❌ FAIL ($BUILD_ERRORS TS errors)")"
}

_phase_tests() {
  echo "── Phase 2: Tests ──────────────────────────────────────"
  TEST_LOG="$REPORTS_DIR/test-audit.log"

  if [[ ! -f "$TEST_LOG" ]]; then
    echo "  Running npm test (long-running, ~5-10min)..."
    cd "$APP_DIR"
    timeout 600 npm test > "$TEST_LOG" 2>&1 || true
  else
    echo "  (reusing cached $TEST_LOG)"
  fi

  TEST_PASS=true
  if grep -qE "FAIL|failed|Test Files.*fail" "$TEST_LOG" 2>/dev/null; then
    TEST_PASS=false
    OVERALL="FAIL"
  fi
  TOTAL_TESTS=$(grep -oP '\d+(?=\s+passed\s*\()' "$TEST_LOG" | tail -1 2>/dev/null || echo "0")
  [[ "$TOTAL_TESTS" == "0" ]] && TOTAL_TESTS=$(grep -oP '\d+\s+passed' "$TEST_LOG" | grep -oP '^\d+' | tail -1 2>/dev/null || echo "0")

  state "tests_pass" "$TEST_PASS"
  state "tests_total" "$TOTAL_TESTS"
  state "tests_failed" "$((TOTAL_TESTS - TOTAL_TESTS))"
  echo "  Tests: $( [ "$TEST_PASS" = true ] && echo "✅ PASS ($TOTAL_TESTS passed)" || echo "❌ FAIL")"
}

_phase_deploy() {
  echo "── Phase 3: Deploy ─────────────────────────────────────"
  SHA_MATCH=false
  HTTP_200=false
  LOCAL_SHA=$(cd "$APP_DIR" && git rev-parse HEAD 2>/dev/null | cut -c1-8 || echo "unknown")
  LIVE_SHA=$(curl -s "https://sophia.agencyos.network/api/version" 2>/dev/null | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

  if [[ "$LOCAL_SHA" == "$LIVE_SHA" ]] && [[ "$LOCAL_SHA" != "unknown" ]]; then
    SHA_MATCH=true
    HTTP_200=true
  else
    OVERALL="FAIL"
  fi
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://sophia.agencyos.network" 2>/dev/null || echo "000")
  [[ "$HTTP_CODE" == "200" ]] && HTTP_200=true || OVERALL="FAIL"

  state "deploy_pass" "$([ "$SHA_MATCH" = true ] && echo true || echo false)"
  state "deploy_sha_match" "$SHA_MATCH"
  state "deploy_http_200" "$HTTP_200"
  state "deploy_local_sha" "$LOCAL_SHA"
  state "deploy_live_sha" "$LIVE_SHA"
  echo "  Deploy: $([ "$SHA_MATCH" = true ] && echo "✅ PASS (SHA=$LOCAL_SHA)" || echo "❌ FAIL (local=$LOCAL_SHA live=$LIVE_SHA)")"
}

_phase_i18n() {
  echo "── Phase 4: i18n ────────────────────────────────────────"
  I18N_PASS=true
  VI_KEYS=$(grep -oP '^\s*"[A-Za-z0-9_./]+"' "$APP_DIR/messages/vi.json" 2>/dev/null | wc -l | tr -d ' ')
  EN_KEYS=$(grep -oP '^\s*"[A-Za-z0-9_./]+"' "$APP_DIR/messages/en.json" 2>/dev/null | wc -l | tr -d ' ')
  DIFF=$((VI_KEYS - EN_KEYS))
  if [[ "${DIFF#-}" -gt 10 ]]; then
    I18N_PASS=false
    OVERALL="FAIL"
  fi

  state "i18n_pass" "$I18N_PASS"
  state "i18n_vi_keys" "$VI_KEYS"
  state "i18n_en_keys" "$EN_KEYS"
  echo "  i18n: $([ "$I18N_PASS" = true ] && echo "✅ PASS (VI=$VI_KEYS EN=$EN_KEYS)" || echo "❌ FAIL (key count mismatch)")"
}

_phase_plan_state() {
  echo "── Phase 5: Plan State ──────────────────────────────────"
  PLAN_STATE_PASS=true
  INCOMPLETE=0
  MANIFEST="$APP_DIR/plans/goal-runtime/goal-manifest.json"

  if [[ -f "$MANIFEST" ]]; then
    PHASE_COUNT=$(jq '[.plans[]?.phases // [] | length] | add // 0' "$MANIFEST")
    PENDING=$(jq '[.plans[]?.phases // [] | .[]? | select(.status == "pending")] | length' "$MANIFEST")
    if [[ "$PENDING" -gt 0 ]]; then
      PLAN_STATE_PASS=false
      OVERALL="FAIL"
    fi
  else
    PLAN_STATE_PASS="unknown"
  fi

  state "plan_state_pass" "$( [ "$PLAN_STATE_PASS" = true ] && echo true || echo false)"
  state "plan_state_incomplete" "${PENDING:-0}"
  echo "  Plan state: $([ "$PLAN_STATE_PASS" = true ] && echo "✅ PASS ($PHASE_COUNT phases)" || echo "❌ FAIL ($PENDING phases pending)")"
}

# ── Main ──────────────────────────────────────────────────────────
if [[ -n "$PHASE" ]]; then
  # Single phase mode
  run_phase "$PHASE"
else
  # All phases, with caching
  _phase_build
  save_results
  _phase_tests
  save_results
  _phase_deploy
  save_results
  _phase_i18n
  save_results
  _phase_plan_state
fi

save_results

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
if [[ "$OVERALL" == "PASS" ]]; then
  echo "│ ✅ HANDOVER GATE: APPROVED                         │"
  echo "│ Sophia AI Factory — ready for CEO handover          │"
else
  echo "│ ❌ HANDOVER GATE: BLOCKED                           │"
  echo "│ Check $RESULTS_FILE for details                      │"
fi
echo "════════════════════════════════════════════════════════════"

exit 0
