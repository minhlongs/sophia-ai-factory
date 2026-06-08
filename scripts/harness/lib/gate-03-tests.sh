#!/usr/bin/env bash
# Gate 3 — Vitest tests
# Sources: scripts/harness/lib/gates.sh
# Evidence: plans/evidence/tests.log

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_LIB="$SCRIPT_DIR/../lib/gates.sh"
source "$HARNESS_LIB"

gate_register "tests"

cd "$APP_DIR"
START_MS=$(date +%s%N)

OUTPUT=$(npx vitest run 2>&1) && TEST_EXIT=0 || TEST_EXIT=$?
END_MS=$(date +%s%N)
DURATION=$(( (END_MS - START_MS) / 1000000 ))

echo "$OUTPUT" > "$EVIDENCE_DIR/tests.log"

if [ "$TEST_EXIT" -eq 0 ]; then
  PASSED=$(echo "$OUTPUT" | grep -oE '[0-9]+ passed' | grep -oE '^[0-9]+' || echo "0")
  SKIPPED=$(echo "$OUTPUT" | grep -oE '[0-9]+ skipped' | grep -oE '^[0-9]+' || echo "0")
  gate_run "tests" "$DURATION" "{\"passed\":$PASSED,\"skipped\":$SKIPPED}" "false"
else
  FAILED=$(echo "$OUTPUT" | grep -oE '[0-9]+ failed' | grep -oE '^[0-9]+' || echo "?")
  gate_fail "tests" "$DURATION" "{\"failed\":$FAILED}" "false"
fi

gate_summary
exit $TEST_EXIT
