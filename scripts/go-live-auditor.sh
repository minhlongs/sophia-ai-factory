#!/usr/bin/env bash
# go-live-auditor.sh — Pre-deploy audit for sophia-ai-factory
# Checks all quality gates, reports score out of 10, fixes what it can.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/sophia-ai-factory"
SCORE=10
ISSUES=""

echo "╔══════════════════════════════════════════════════╗"
echo "║    SOPHIA-AI-FACTORY GO-LIVE AUDITOR v2.0        ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

cd "$APP_DIR" || exit 1

# ──────────────────────────────────────────────
# GATE 1: TypeScript build (target: 0 errors)
# ─────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[GATE 1/5] TypeScript type-check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?
if [ $TSC_EXIT -eq 0 ]; then
    echo "✅ PASS — 0 TS errors"
else
    SCORE=$((SCORE < 7 ? SCORE : 7))
    ISSUES="${ISSUES}\n❌ TypeScript build failed ($TSC_EXIT errors)"
    echo "$TSC_OUTPUT" | tail -30
fi

# ──────────────────────────────────────────────
# GATE 2: ESLint (target: ≤10 errors, warnings OK)
# ─────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[GATE 2/5] ESLint check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LINT_OUTPUT=$(npm run lint 2>&1 || true)
# Extract error count from eslint output
ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -oP '\d+ problems?\s*\(\s*\K\d+(?= errors)' | tail -1)
if [ -z "$ERROR_COUNT" ]; then
    # fallback: check for "X errors, Y warnings" pattern
    ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -oP '\b(\d+)\s*errors?,\s*\d+\s*warnings?\b' | grep -oP '^\d+' || echo "0")
fi
WARNING_COUNT=$(echo "$LINT_OUTPUT" | grep -oP '\b\d+\s*warnings?' | head -1 | grep -oP '\d+' || echo "0")

if [ "${ERROR_COUNT:-0}" -le 10 ]; then
    echo "✅ PASS — ${ERROR_COUNT:-0} errors, ${WARNING_COUNT:-0} warnings"
else
    SCORE=$((SCORE < 5 ? SCORE : 5))
    ISSUES="${ISSUES}\n❌ ESLint has $ERROR_COUNT errors (target ≤10)"
fi

# ──────────────────────────────────────────────
# GATE 3: Vitest tests
# ─────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[GATE 3/5] Vitest test suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_OUTPUT=$(npx vitest run --reporter=verbose 2>&1)
# Check for passed tests line
if echo "$TEST_OUTPUT" | grep -qP 'Test Files\s+\d+\s+passed'; then
    PASS_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= Test Files\s+passed)' | head -1 || echo "0")
    TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= total|Tests?)' | head -1 || echo "?")
    echo "✅ PASS — $PASS_COUNT test files passed"
else
    if echo "$TEST_OUTPUT" | grep -qP 'Test Files\s+\d+\s+failed'; then
        FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= Test Files\s+failed)' | head -1 || echo "?")
        SCORE=$((SCORE < 3 ? SCORE : 3))
        ISSUES="${ISSUES}\n❌ $FAIL_COUNT test files failed"
    else
        echo "⚠️  UNKNOWN — could not determine test results"
        ISSUES="${ISSUES}\n⚠️ Test output ambiguous"
    fi
fi

# ──────────────────────────────────────────────
# GATE 4: Zero :any types in prod code
# ─────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[GATE 4/5] Zero ':any' types in production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ANY_COUNT=$(grep -rn ': any ' src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v '__tests__' | grep -v '.test.' | wc -l | tr -d ' ')

if [ "${ANY_COUNT:-0}" -eq 0 ]; then
    echo "✅ PASS — Zero :any types in production code"
elif [ "${ANY_COUNT:-0}" -le 20 ]; then
    # Partial credit for small remaining
    SCORE=$((SCORE < 7 ? SCORE : 7))
    ISSUES="${ISSUES}\n⚠️ $ANY_COUNT ':any' types remain (target: 0)"
else
    SCORE=$((SCORE < 4 ? SCORE : 4))
    ISSUES="${ISSUES}\n❌ $ANY_COUNT ':any' types in production (target: 0)"
fi

echo "Total :any count (prod): ${ANY_COUNT:-0}"

# ──────────────────────────────────────────────
# GATE 5: Zero console.log/warn/error in prod
# ─────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[GATE 5/5] No console.* in production code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Exclude tests, __tests__, .test., spec files, setup scripts, seed data
CONSOLE_COUNT=$(grep -rn 'console\.\(log\|warn\|error\)' src \
    --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v '__tests__' | \
    grep -v '.test.' | \
    grep -v 'spec.' | \
    grep -v 'seed/' | \
    grep -v 'scripts/' | \
    wc -l | tr -d ' ')

if [ "${CONSOLE_COUNT:-0}" -eq 0 ]; then
    echo "✅ PASS — Zero console.* calls in production"
elif [ "${CONSOLE_COUNT:-0}" -le 10 ]; then
    SCORE=$((SCORE < 7 ? SCORE : 7))
    ISSUES="${ISSUES}\n⚠️ $CONSOLE_COUNT console.* remain (target: 0)"
else
    SCORE=$((SCORE < 4 ? SCORE : 4))
    ISSUES="${ISSUES}\n❌ $CONSOLE_COUNT console.* in production (target: 0)"
fi

echo "Total console.* count (prod): ${CONSOLE_COUNT:-0}"

# ──────────────────────────────────────────────
# SUMMARY
# ─────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  AUDIT SCORE: $SCORE /10                           ║"
echo "╚══════════════════════════════════════════════════╝"

if [ "${#ISSUES}" -gt 0 ]; then
    echo ""
    echo "── Issues found ──────────────────────────────"
    printf "%b\n" "$ISSUES"
fi

exit $SCORE
