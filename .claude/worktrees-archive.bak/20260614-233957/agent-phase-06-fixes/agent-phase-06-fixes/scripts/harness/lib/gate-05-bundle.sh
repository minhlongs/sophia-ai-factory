#!/usr/bin/env bash
# Gate 5 — Bundle size (Next.js build output)
# Sources: scripts/harness/lib/gates.sh
# Evidence: plans/evidence/bundle.log

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_LIB="$SCRIPT_DIR/../lib/gates.sh"
source "$HARNESS_LIB"

gate_register "bundle"

cd "$APP_DIR"
START_MS=$(date +%s%N)

# Run build, capture output
BUILD_OUTPUT=$(npm run build 2>&1) && BUILD_EXIT=0 || BUILD_EXIT=$?
END_MS=$(date +%s%N)
DURATION=$(( (END_MS - START_MS) / 1000000 ))

echo "$BUILD_OUTPUT" > "$EVIDENCE_DIR/bundle.log"

if [ "$BUILD_EXIT" -ne 0 ]; then
  gate_fail "bundle" "$DURATION" "{\"error\":\"build failed\"}" "false"
  gate_summary
  exit 1
fi

# Extract bundle sizes from build output
ROUTE_SIZES=$(echo "$BUILD_OUTPUT" | grep -E "\([0-9.]+ (KB|MB)\)" | head -20 || true)
TOTAL_KB=$(echo "$BUILD_OUTPUT" | grep -oE "Total: [0-9.]+" | grep -oE "[0-9.]+" || echo "0")

# Check for oversized routes (> 500KB first load)
OVERSIZED=""
if [ -n "$ROUTE_SIZES" ]; then
  OVERSIZED=$(echo "$ROUTE_SIZES" | awk '{split($0,a,"("); split(a[2],b," "); if (b[1]+0 > 500) print}' || true)
fi

FIXABLE="false"
if [ -n "$OVERSIZED" ]; then
  gate_run "bundle" "$DURATION" "{\"total_kb\":$TOTAL_KB,\"oversized_routes\":$(echo "$OVERSIZED" | wc -l | tr -d ' ')}" "$FIXABLE"
else
  gate_run "bundle" "$DURATION" "{\"total_kb\":$TOTAL_KB}" "$FIXABLE"
fi

gate_summary
exit 0
