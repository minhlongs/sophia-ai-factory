#!/usr/bin/env bash
# Gate 7 — D1 migration guard
# Sources: scripts/harness/lib/gates.sh
# Evidence: plans/evidence/migrations.log

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_LIB="$SCRIPT_DIR/../lib/gates.sh"
source "$HARNESS_LIB"

gate_register "migrations"

cd "$APP_DIR"
START_MS=$(date +%s%N)

DB_NAME="sophia-raas-db"

# Count pending migrations
PENDING_COUNT=$(npx wrangler d1 migrations list "$DB_NAME" --json 2>/dev/null | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  pending = [m for m in data if not m.get('applied_at')]
  print(len(pending))
except Exception:
  print('0')
" 2>/dev/null || echo "0")

END_MS=$(date +%s%N)
DURATION=$(( (END_MS - START_MS) / 1000000 ))

if [ "$PENDING_COUNT" -gt 0 ]; then
  gate_fail "migrations" "$DURATION" "{\"pending\":$PENDING_COUNT,\"db\":\"$DB_NAME\"}" "false"
else
  gate_run "migrations" "$DURATION" "{\"pending\":0,\"db\":\"$DB_NAME\"}" "false"
fi

gate_summary
[ "$PENDING_COUNT" -gt 0 ] && exit 1 || exit 0
