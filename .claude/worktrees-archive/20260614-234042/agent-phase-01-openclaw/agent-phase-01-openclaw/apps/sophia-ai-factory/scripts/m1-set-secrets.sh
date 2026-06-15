#!/usr/bin/env bash
# Sprint M Phase 1 — Production CF Secrets setup
#
# Run manually after D1 migrations applied to remote.
# Each `secret put` reads from stdin (paste real value, then Ctrl+D).
# DO NOT commit real secret values — this file is safe to commit (echo only).
#
# Prerequisites:
#   - wrangler authenticated: npx wrangler whoami
#   - CF_ACCOUNT_ID set or wrangler.toml present
#
# Usage:
#   cd apps/sophia-ai-factory
#   bash scripts/m1-set-secrets.sh
#
# After running, verify: npx wrangler secret list

set -e
cd "$(dirname "$0")/.."

secrets=(
  OPENROUTER_API_KEY
  ELEVENLABS_API_KEY
  HEYGEN_API_KEY
  NOWPAYMENTS_API_KEY
  NOWPAYMENTS_IPN_SECRET
  TELEGRAM_BOT_TOKEN
  INNGEST_SIGNING_KEY
  INNGEST_EVENT_KEY
)

for s in "${secrets[@]}"; do
  echo ""
  echo "=== Setting ${s} (paste value, then Ctrl+D) ==="
  npx wrangler secret put "${s}"
done

echo ""
echo "Done. Verify with:"
echo "  npx wrangler secret list"
