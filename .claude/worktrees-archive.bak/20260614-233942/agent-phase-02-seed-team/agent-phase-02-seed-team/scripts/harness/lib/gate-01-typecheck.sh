#!/usr/bin/env bash
# Gate 1 — TypeScript type-check
# Sources: scripts/harness/lib/gates.sh
# Evidence: plans/evidence/tsc.log

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_LIB="$SCRIPT_DIR/../lib/gates.sh"
source "$HARNESS_LIB"

gate_register "typecheck"

cd "$APP_DIR"
START_MS=$(date +%s%N)

OUTPUT=$(npx tsc --noEmit 2>&1) && TSC_EXIT=0 || TSC_EXIT=$?
END_MS=$(date +%s%N)
DURATION=$(( (END_MS - START_MS) / 1000000 ))

echo "$OUTPUT" > "$EVIDENCE_DIR/tsc.log"

if [ "$TSC_EXIT" -eq 0 ]; then
  gate_run "typecheck" "$DURATION" "[]" "false"
else
  ERROR_COUNT=$(echo "$OUTPUT" | grep -c "error TS" || echo "0")
  gate_fail "typecheck" "$DURATION" "{\"errors\":$ERROR_COUNT}" "false"
fi

gate_summary
exit $TSC_EXIT
