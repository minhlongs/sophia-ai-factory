#!/usr/bin/env bash
#
# configure-upstash-qstash.sh — One-shot setup to register the daily
# D1 backup cron with Upstash QStash. See docs/dev-sops.md SOP 14.
#
# Prerequisites:
#   - QSTASH_TOKEN exported (obtain at https://console.upstash.com)
#   - CRON_SECRET exported (must match the wrangler secret on the Worker)
#
# Usage:
#   QSTASH_TOKEN=... CRON_SECRET=... bash scripts/dr/configure-upstash-qstash.sh
#
set -euo pipefail

: "${QSTASH_TOKEN:?QSTASH_TOKEN required — get from Upstash console}"
: "${CRON_SECRET:?CRON_SECRET required — must match wrangler secret on Worker}"

ENDPOINT="https://sophia.agencyos.network/api/cron/d1-backup"
CRON_EXPR="${CRON_EXPR:-0 3 * * *}"   # 03:00 UTC daily by default

echo "Registering QStash schedule:"
echo "  endpoint: $ENDPOINT"
echo "  cron:     $CRON_EXPR"

RESPONSE=$(curl -sS -X POST \
  "https://qstash.upstash.io/v2/schedules/${ENDPOINT}" \
  -H "Authorization: Bearer ${QSTASH_TOKEN}" \
  -H "Upstash-Cron: ${CRON_EXPR}" \
  -H "Upstash-Forward-x-cron-secret: ${CRON_SECRET}")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"scheduleId"'; then
  echo "Schedule registered."
  echo "Next run will be at next ${CRON_EXPR} UTC."
  echo "Verify after first run with:"
  echo "  npx wrangler r2 object list sophia-backups --prefix='d1-' | head"
else
  echo "FAILED to register schedule. Inspect response above."
  exit 1
fi
