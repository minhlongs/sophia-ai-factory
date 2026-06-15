#!/usr/bin/env bash
# capture-tail.sh — Capture wrangler tail output during E2E browser test.
# Writes raw log to /tmp/sophia-e2e-tail.raw.log and filtered slice.
# Signals completion by watching for /tmp/e2e-done flag file.
#
# Usage: ./scripts/e2e/capture-tail.sh &
# Signal done: touch /tmp/e2e-done
# Then wait for this script to finish flushing.

set -euo pipefail

WORKER_NAME="sophia-ai-factory"
RAW_LOG="/tmp/sophia-e2e-tail.raw.log"
FILTERED_LOG="/tmp/sophia-e2e-tail.filtered.log"
DONE_FLAG="/tmp/e2e-done"

# Clean previous logs
rm -f "$RAW_LOG" "$FILTERED_LOG" "$DONE_FLAG"

echo "[tail] Starting wrangler tail for ${WORKER_NAME}..."
npx wrangler tail "$WORKER_NAME" --format pretty > "$RAW_LOG" 2>&1 &
TAIL_PID=$!
trap "kill $TAIL_PID 2>/dev/null || true" EXIT

echo "[tail] Tail PID=${TAIL_PID} — waiting for /tmp/e2e-done..."

# Wait for done flag (max 3 minutes)
MAX_WAIT=180
ELAPSED=0
while [ ! -f "$DONE_FLAG" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  sleep 2
  ELAPSED=$(( ELAPSED + 2 ))
done

# Grace period to capture final log lines
sleep 10

echo "[tail] Flushing and filtering logs..."
kill "$TAIL_PID" 2>/dev/null || true
wait "$TAIL_PID" 2>/dev/null || true

# Filter to E2E-relevant events
grep -E "(welcome/validate|setup-wizard|Welcome/Consume|better-auth-session|magic_link|no authenticated user|session_token|BETTER_AUTH)" \
  "$RAW_LOG" > "$FILTERED_LOG" 2>/dev/null || echo "[tail] No matching log lines found" > "$FILTERED_LOG"

echo "[tail] Raw: $RAW_LOG  Filtered: $FILTERED_LOG"
echo "[tail] Filtered line count: $(wc -l < "$FILTERED_LOG")"
cat "$FILTERED_LOG"
