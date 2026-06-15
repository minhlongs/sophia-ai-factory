#!/usr/bin/env bash
# Gate 6 — i18n key validation
# Sources: scripts/harness/lib/gates.sh
# Evidence: plans/evidence/i18n.log

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_LIB="$SCRIPT_DIR/../lib/gates.sh"
source "$HARNESS_LIB"

gate_register "i18n"

cd "$APP_DIR"
START_MS=$(date +%s%N)

OUTPUT=$(npm run i18n:validate 2>&1) && I18N_EXIT=0 || I18N_EXIT=$?
END_MS=$(date +%s%N)
DURATION=$(( (END_MS - START_MS) / 1000000 ))

echo "$OUTPUT" > "$EVIDENCE_DIR/i18n.log"

if [ "$I18N_EXIT" -eq 0 ]; then
  TOTAL=$(echo "$OUTPUT" | grep "Total t() calls:" | grep -oE '[0-9]+' | head -1 || echo "?")
  MISSING=$(echo "$OUTPUT" | grep "Missing static keys:" | grep -oE '[0-9]+' | head -1 || echo "0")
  gate_run "i18n" "$DURATION" "{\"total_keys\":$TOTAL,\"missing\":$MISSING}" "true"
else
  gate_fail "i18n" "$DURATION" "{\"error\":\"validation failed\"}" "true"
fi

gate_summary
exit $I18N_EXIT
