#!/usr/bin/env bash
# migration-guard.sh — RED-TEAM #6
# Checks if D1 migrations are pending before canary deploy.
# If pending: exits 1 — forces sequential 100%:0% deploy path.
# NO canary during migration window (schema skew = data loss risk).
# Requires: CLOUDFLARE_API_TOKEN env var set.
set -euo pipefail

DB_NAME="sophia-raas-db"

echo "[migration-guard] Checking D1 pending migrations for $DB_NAME..."

PENDING=$(wrangler d1 migrations list "$DB_NAME" --json 2>/dev/null \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
pending = [m for m in data if not m.get('applied_at')]
print(len(pending))
for m in pending:
    print('  PENDING:', m.get('name', m.get('id', '?')), file=sys.stderr)
" 2>&1 >/dev/null || echo "0")

# Capture pending count (stdout only)
PENDING_COUNT=$(wrangler d1 migrations list "$DB_NAME" --json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    pending = [m for m in data if not m.get('applied_at')]
    print(len(pending))
except Exception as e:
    print('0')
" 2>/dev/null || echo "0")

if [ "$PENDING_COUNT" -gt 0 ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  MIGRATION_PENDING — CANARY BLOCKED                         ║"
  echo "║                                                              ║"
  echo "║  $PENDING_COUNT pending D1 migration(s) detected.               ║"
  echo "║                                                              ║"
  echo "║  Required deploy sequence:                                   ║"
  echo "║    1. wrangler deploy (100%:0% — full sequential)            ║"
  echo "║    2. wrangler d1 migrations apply sophia-raas-db            ║"
  echo "║    3. wrangler versions upload (new version)                 ║"
  echo "║    4. wrangler versions deploy <new>:100%                    ║"
  echo "║                                                              ║"
  echo "║  DO NOT use canary split during migration window.            ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  exit 1
fi

echo "[migration-guard] No pending migrations. Canary deploy is SAFE."
exit 0
