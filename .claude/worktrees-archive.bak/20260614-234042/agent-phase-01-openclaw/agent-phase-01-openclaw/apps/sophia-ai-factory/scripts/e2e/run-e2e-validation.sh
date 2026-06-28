#!/usr/bin/env bash
# run-e2e-validation.sh — Orchestrator for full magic-link E2E validation.
# Chains: capture-tail (background) → seed → browser test → cleanup signal → aggregate logs.
#
# Usage: ./scripts/e2e/run-e2e-validation.sh
# Output: plans/260503-0830-sophia-magic-link-e2e-validation/reports/ (logs + browser JSON)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
REPORTS_DIR="${PROJECT_ROOT}/plans/260503-0830-sophia-magic-link-e2e-validation/reports"
DONE_FLAG="/tmp/e2e-done"

mkdir -p "$REPORTS_DIR"
rm -f "$DONE_FLAG"

echo "=== Phase 03: Starting wrangler tail capture ==="
bash "$SCRIPT_DIR/capture-tail.sh" &
TAIL_SCRIPT_PID=$!
sleep 3  # Give tail time to connect

echo "=== Phase 01: Seeding test data ==="
MAGIC_LINK_URL=$(bash "$SCRIPT_DIR/seed-magic-link.sh" | tail -1)
echo "Magic link URL: $MAGIC_LINK_URL"

if [ -z "$MAGIC_LINK_URL" ] || [[ "$MAGIC_LINK_URL" != http* ]]; then
  echo "ERROR: seed-magic-link.sh did not output a valid URL"
  touch "$DONE_FLAG"
  exit 1
fi

echo "=== Phase 02: Running browser E2E test ==="
BROWSER_OUTPUT_FILE="${REPORTS_DIR}/browser-test-$(date +%s).json"

set +e
node "$SCRIPT_DIR/run-magic-link-browser-test.mjs" "$MAGIC_LINK_URL" > "$BROWSER_OUTPUT_FILE"
BROWSER_EXIT=$?
set -e

echo "Browser test exit code: $BROWSER_EXIT"
echo "Browser output saved to: $BROWSER_OUTPUT_FILE"

VERDICT=$(node -e "const r=require('fs').readFileSync('$BROWSER_OUTPUT_FILE','utf8'); console.log(JSON.parse(r).verdict)" 2>/dev/null || echo "FAIL")
echo "=== VERDICT: $VERDICT ==="

# Signal tail to flush
touch "$DONE_FLAG"
sleep 12  # Wait for tail to flush + filter

# Copy logs to reports dir
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp /tmp/sophia-e2e-tail.raw.log "${REPORTS_DIR}/wrangler-tail-${TIMESTAMP}.raw.log" 2>/dev/null || true
cp /tmp/sophia-e2e-tail.filtered.log "${REPORTS_DIR}/wrangler-tail-${TIMESTAMP}.filtered.log" 2>/dev/null || true

echo ""
echo "=== E2E Validation Summary ==="
echo "Verdict:        $VERDICT"
echo "Browser JSON:   $BROWSER_OUTPUT_FILE"
echo "Raw tail log:   ${REPORTS_DIR}/wrangler-tail-${TIMESTAMP}.raw.log"
echo "Filtered log:   ${REPORTS_DIR}/wrangler-tail-${TIMESTAMP}.filtered.log"
echo ""

if [ "$BROWSER_EXIT" -ne 0 ]; then
  echo "Phase 02 FAIL — proceed to Phase 04 hypothesis resolution"
  exit 1
fi
echo "Phase 02 PASS — proceed to Phase 05 regression test"
