#!/usr/bin/env bash
# Quality Gates Re-run — Phase 00 Follow-up
# Run after buffer fixes (Phases 01-06) to verify production readiness

set -e

cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory

echo "=== Quality Gates Re-run ===$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Node version check
echo "Node.js: $(node --version)"
echo ""

# Typecheck
echo "▶ Running typecheck..."
npm run ci:typecheck 2>&1 | tee /tmp/typecheck-re-run.log
TYPECHECK_EXIT=${PIPESTATUS[0]}
TYPE_ERRORS=$(grep -c "error TS" /tmp/typecheck-re-run.log 2>/dev/null || echo 0)
echo "Typecheck exit: $TYPECHECK_EXIT, errors: $TYPE_ERRORS"
echo ""

# Tests
echo "▶ Running tests..."
npm run ci:test 2>&1 | tee /tmp/test-re-run.log
TEST_EXIT=${PIPESTATUS[0]}
# Extract test summary from log
TEST_SUMMARY=$(grep -E "Test Files|Tests" /tmp/test-re-run.log | tail -2)
echo "$TEST_SUMMARY"
echo "Test exit: $TEST_EXIT"
echo ""

# Lint
echo "▶ Running lint..."
npm run ci:lint 2>&1 | tee /tmp/lint-re-run.log
LINT_EXIT=${PIPESTATUS[0]}
LINT_ERRORS=$(grep -c "error" /tmp/lint-re-run.log 2>/dev/null || echo 0)
LINT_WARNINGS=$(grep -c "warning" /tmp/lint-re-run.log 2>/dev/null || echo 0)
echo "Lint exit: $LINT_EXIT, errors: $LINT_ERRORS, warnings: $LINT_WARNINGS"
echo ""

# Side-effects
echo "▶ Running side-effects check..."
npm run ci:get-side-effects 2>&1 | tee /tmp/side-effects-re-run.log
SIDEEFFECTS_EXIT=${PIPESTATUS[0]}
echo "Side-effects exit: $SIDEEFFECTS_EXIT"
echo ""

# Summary
echo "=== Summary ==="
echo "Node.js: $(node --version)"
echo "Typecheck: exit $TYPECHECK_EXIT ($TYPE_ERRORS errors)"
echo "Tests: exit $TEST_EXIT"
echo "Lint: exit $LINT_EXIT ($LINT_ERRORS errors, $LINT_WARNINGS warnings)"
echo "Side-effects: exit $SIDEEFFECTS_EXIT"
echo ""

# Decision
if [ $TYPECHECK_EXIT -eq 0 ] && [ $TEST_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ] && [ $SIDEEFFECTS_EXIT -eq 0 ]; then
  echo "✅ ALL QUALITY GATES PASSED"
  exit 0
else
  echo "❌ QUALITY GATES FAILED — review needed"
  exit 1
fi
