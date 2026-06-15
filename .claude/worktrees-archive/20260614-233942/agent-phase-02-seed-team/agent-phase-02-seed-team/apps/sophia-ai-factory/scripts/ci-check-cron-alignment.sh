#!/usr/bin/env bash
# CI check: verify wrangler.toml triggers.crons matches CRON_ROUTES in
# inject-scheduled-handler.mjs. Catches orphan/extra cron entries.
#
# Run: bash scripts/ci-check-cron-alignment.sh

set -euo pipefail

WRANGLER_FILE="${1:-wrangler.toml}"
HANDLER_FILE="${2:-scripts/inject-scheduled-handler.mjs}"

if [ ! -f "$WRANGLER_FILE" ] || [ ! -f "$HANDLER_FILE" ]; then
  echo "Missing wrangler.toml or inject-scheduled-handler.mjs"; exit 1
fi

# Extract crons array values from wrangler.toml (single-line arrays like 'crons = ["a", "b"]')
WRANGLER_CRONS=$(grep -E "^crons\s*=" "$WRANGLER_FILE" \
  | grep -oE '"[^"]+"' \
  | tr -d '"' \
  | sort -u)

# Extract CRON_ROUTES keys from handler script (lines like "'*/5 * * * *':")
HANDLER_CRONS=$(grep -oE "'[^']+':\s*\[" "$HANDLER_FILE" \
  | sed -E "s/'([^']+)':.*/\1/" \
  | sort -u)

echo "wrangler.toml crons:"
echo "$WRANGLER_CRONS" | sed 's/^/  /'
echo
echo "handler CRON_ROUTES patterns:"
echo "$HANDLER_CRONS" | sed 's/^/  /'
echo

ORPHAN_IN_HANDLER=$(comm -23 <(echo "$HANDLER_CRONS") <(echo "$WRANGLER_CRONS") || true)
ORPHAN_IN_WRANGLER=$(comm -13 <(echo "$HANDLER_CRONS") <(echo "$WRANGLER_CRONS") || true)

FAIL=0
if [ -n "$ORPHAN_IN_HANDLER" ]; then
  echo "❌ Orphan patterns in handler (no matching wrangler trigger):"
  echo "$ORPHAN_IN_HANDLER" | sed 's/^/  /'
  FAIL=1
fi
if [ -n "$ORPHAN_IN_WRANGLER" ]; then
  echo "❌ Orphan patterns in wrangler.toml (no matching handler):"
  echo "$ORPHAN_IN_WRANGLER" | sed 's/^/  /'
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "✅ Cron alignment OK ($(echo "$WRANGLER_CRONS" | wc -l | tr -d ' ') patterns match)"
else
  exit 1
fi
