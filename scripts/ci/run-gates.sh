#!/usr/bin/env bash
# run-gates.sh — Local pre-push runner for gates 1 + 3.
# Mirrors quality-gate.yml so devs catch failures before CI.
# Usage: ./scripts/ci/run-gates.sh [--fix]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="$REPO_ROOT/apps/sophia-ai-factory"
FIX_MODE="${1:-}"

echo "=== Local Gate Runner (mirrors quality-gate.yml) ==="

cd "$APP_DIR"

# Gate 1a: TypeScript
echo ""
echo "[gate-1a] TypeScript type check..."
npx tsc --noEmit
echo "[gate-1a] PASS"

# Gate 1b: ESLint
echo ""
echo "[gate-1b] ESLint..."
if [ "$FIX_MODE" = "--fix" ]; then
  npx next lint --fix
else
  npx next lint
fi
echo "[gate-1b] PASS"

# Gate 1c: Tests with coverage
echo ""
echo "[gate-1c] Vitest with coverage..."
npm test -- --coverage --reporter=verbose
echo "[gate-1c] PASS"

# Gate 3a: Coverage threshold (>= 70%)
echo ""
echo "[gate-3a] Coverage threshold check (>= 70%)..."
COVERAGE_FILE="coverage/coverage-summary.json"
if [ -f "$COVERAGE_FILE" ]; then
  python3 -c "
import json, sys
data = json.load(open('$COVERAGE_FILE'))
total = data.get('total', {})
lines_pct = total.get('lines', {}).get('pct', 0)
print(f'  Lines coverage: {lines_pct}%')
if lines_pct < 70:
    print(f'  FAIL: coverage {lines_pct}% < 70% threshold')
    sys.exit(1)
print('  PASS: coverage above 70% threshold')
"
fi
echo "[gate-3a] PASS"

# Gate 3b: Zero :any types
echo ""
echo "[gate-3b] Zero ':any' type check..."
ANY_COUNT=$(grep -rn ': any' src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ANY_COUNT" -gt 0 ]; then
  echo "[gate-3b] FAIL: $ANY_COUNT ':any' occurrences found:"
  grep -rn ': any' src --include="*.ts" --include="*.tsx" || true
  exit 1
fi
echo "[gate-3b] PASS: 0 ':any' types"

# Gate 3c: Zero console.log/warn/error in prod code
echo ""
echo "[gate-3c] Zero console.* in production code..."
CONSOLE_COUNT=$(grep -rn 'console\.\(log\|warn\|error\)' src --include="*.ts" --include="*.tsx" 2>/dev/null | \
  grep -v '// eslint-disable' | grep -v '__tests__' | wc -l | tr -d ' ')
if [ "$CONSOLE_COUNT" -gt 0 ]; then
  echo "[gate-3c] FAIL: $CONSOLE_COUNT console.* calls found in production code:"
  grep -rn 'console\.\(log\|warn\|error\)' src --include="*.ts" --include="*.tsx" | grep -v '__tests__' || true
  exit 1
fi
echo "[gate-3c] PASS: 0 console.* calls"

echo ""
echo "=== All local gates PASSED. Safe to push. ==="
