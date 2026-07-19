#!/usr/bin/env bash
# Gate 2 — ESLint
# Sources: scripts/harness/lib/gates.sh
# Evidence: plans/evidence/lint.log

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_LIB="$SCRIPT_DIR/../lib/gates.sh"
source "$HARNESS_LIB"

gate_register "lint"

cd "$APP_DIR"
START_MS=$(date +%s%N)

OUTPUT=$(npm run lint 2>&1) && LINT_EXIT=0 || LINT_EXIT=$?
END_MS=$(date +%s%N)
DURATION=$(( (END_MS - START_MS) / 1000000 ))

echo "$OUTPUT" > "$EVIDENCE_DIR/lint.log"

if [ "$LINT_EXIT" -eq 0 ]; then
  ERROR_COUNT=$(echo "$OUTPUT" | grep -oE '[0-9]+ problem' | grep -oE '^[0-9]+' || echo "0")
  gate_run "lint" "$DURATION" "{\"errors\":$ERROR_COUNT}" "true"
else
  ERROR_COUNT=$(echo "$OUTPUT" | grep -oE '[0-9]+ problem' | grep -oE '^[0-9]+' || echo "?")
  gate_fail "lint" "$DURATION" "{\"errors\":$ERROR_COUNT}" "true"
fi

gate_summary
exit $LINT_EXIT
