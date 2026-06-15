#!/usr/bin/env bash
# Gate 8 — SHA match (production verification)
# Sources: scripts/harness/lib/gates.sh
# Evidence: plans/evidence/sha-match.log

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_LIB="$SCRIPT_DIR/../lib/gates.sh"
source "$HARNESS_LIB"

gate_register "sha-match"

cd "$APP_DIR"
START_MS=$(date +%s%N)

PROD_URL="${HARNESS_PROD_URL:-https://sophia.agencyos.network}"
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)

# Fetch live SHA from /api/version
LIVE_SHA=$(curl -s "$PROD_URL/api/version" 2>/dev/null | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "")

# HTTP check
HTTP_CODE=$(curl -sI "$PROD_URL" 2>/dev/null | head -1 | grep -oE '[0-9]{3}' || echo "000")

END_MS=$(date +%s%N)
DURATION=$(( (END_MS - START_MS) / 1000000 ))

RESULT="{\"local_sha\":\"$LOCAL_SHA\",\"live_sha\":\"$LIVE_SHA\",\"http_code\":\"$HTTP_CODE\",\"prod_url\":\"$PROD_URL\"}"

if [ "$LOCAL_SHA" = "$LIVE_SHA" ] && [ "$HTTP_CODE" = "200" ]; then
  gate_run "sha-match" "$DURATION" "$RESULT" "false"
else
  gate_fail "sha-match" "$DURATION" "$RESULT" "false"
fi

gate_summary
exit 0  # Non-blocking — informational gate
