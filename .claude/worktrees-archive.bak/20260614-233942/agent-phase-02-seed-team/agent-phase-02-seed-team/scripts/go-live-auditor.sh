#!/usr/bin/env bash
# go-live-auditor.sh — Pre-deploy audit for sophia-ai-factory (macOS compatible)
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps/sophia-ai-factory" && pwd)"

echo "========================================================"
echo "  SOPHIA-AI-FACTORY GO-LIVE AUDITOR v2.0 (macOS)"
echo "========================================================"
echo ""

cd "$APP_DIR" || exit 1

# ─── GATE 1: TypeScript type-check ──────────────
echo "--- GATE 1/5: TypeScript ---"
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?
if [ $TSC_EXIT -eq 0 ]; then
    echo "✅ PASS — 0 TS errors"
else
    echo "❌ FAIL — $TSC_EXIT TS errors:"
    echo "$TSC_OUTPUT" | tail -30
fi

# ─── GATE 2: ESLint ──────────────────────
echo ""
echo "--- GATE 2/5: ESLint ---"
LINT_OUTPUT=$(npm run lint 2>&1 || true)
ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -oE '[0-9]+ problem' | grep -oE '^[0-9]+' || echo "0")
if [ "${ERROR_COUNT:-0}" -le 10 ]; then
    echo "✅ PASS — ${ERROR_COUNT:-0} errors"
else
    echo "❌ FAIL — $ERROR_COUNT errors (target ≤10)"
fi

# ─── GATE 3: Vitest tests ──────────────
echo ""
echo "--- GATE 3/5: Vitest Tests ---"
TEST_OUTPUT=$(npx vitest run --reporter=verbose 2>&1)
TEST_EXIT=$?
if echo "$TEST_OUTPUT" | grep -q "Test Files.*passed"; then
    TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ test' | head -1 || echo "?")
    echo "✅ PASS — $TEST_COUNT"
elif [ $TEST_EXIT -eq 0 ]; then
     # vitest exit 0 but no match line — check for failure text
    if echo "$TEST_OUTPUT" | grep -qE "FAILED|failed"; then
        FAIL=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ failed' | head -1 || echo "?")
        echo "❌ FAIL — $FAIL"
     else
        echo "⚠️  UNKNOWN — check output manually"
    fi
else
    if echo "$TEST_OUTPUT" | grep -qE "FAILED|failed"; then
        FAIL=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ failed' | head -1 || echo "?")
        echo "❌ FAIL — $FAIL"
    else
        echo "❌ FAIL — vitest exit code: $TEST_EXIT"
     fi
fi

# ─── GATE 4: Zero :any in production ──────────────
echo ""
echo "--- GATE 4/5: Zero ':any' types ---"
ANY_FILES=$(find src -name '*.ts' -o -name '*.tsx' | grep -v '__tests__' | grep -v '.test.' | grep -v 'spec.')
if [ -n "$ANY_FILES" ]; then
    ANY_COUNT=$(grep -rn ': any ' $(echo "$ANY_FILES" | tr '\n' ' ') --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
else
     ANY_COUNT=0
fi
# Alternative: search all non-test files more simply
if [ "$ANY_COUNT" = "0" ] || [ -z "$ANY_COUNT" ]; then
    # Try broader search
    ANY_COUNT=$(find . -path './node_modules' -prune -o \
        \( -name '*.ts' -o -name '*.tsx' \) -print 2>/dev/null | \
        grep -v '__tests__' | grep -v '.test.' | \
        xargs grep -c ': any ' 2>/dev/null | \
        awk '{s+=$1} END {print s}' || echo "0")
fi

if [ "$ANY_COUNT" = "0" ]; then
    echo "✅ PASS — Zero :any in production code"
else
    echo "⚠️  ISSUE — $ANY_COUNT ':any' types remain:"
fi

# ─── GATE 5: No console.log/warn/error in prod ──────
echo ""
echo "--- GATE 5/5: No console.* in production ---"
CONSOLE_FILES=$(find src -name '*.ts' -o -name '*.tsx' | grep -v '__tests__' | grep -v '.test.' | grep -v 'spec.' || true)
if [ -n "$CONSOLE_FILES" ]; then
    CONSOLE_OUTPUT=$(grep -rn 'console\.log\|console\.warn\|console\.error' $CONSOLE_FILES 2>/dev/null || true)
    CONSOLE_COUNT=$(echo "$CONSOLE_OUTPUT" | grep -c '.' || echo "0")
else
    CONSOLE_COUNT=0
fi

if [ "$CONSOLE_COUNT" = "0" ]; then
    echo "✅ PASS — Zero console.* in production"
else
    echo "❌ ISSUE — $CONSOLE_COUNT console.* calls:"
     # Show first 20 lines for context
    echo "$CONSOLE_OUTPUT" | head -20
fi

# ─── SUMMARY ──────────────
echo ""
echo "========================================================"
if [ "$(cat .next/BUILD_ID 2>/dev/null || echo '')" != "" ]; then
     echo "  ✅ BUILD ID exists"
else
     echo "  ⚠️  No BUILD_ID — run npm run build"
fi

# Check git status for uncommitted changes  
UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" = "0" ]; then
    echo "  ✅ Git working tree clean"
else
     echo "  ⚠️  $UNCOMMITED uncommitted changes"
fi

echo "========================================================"
