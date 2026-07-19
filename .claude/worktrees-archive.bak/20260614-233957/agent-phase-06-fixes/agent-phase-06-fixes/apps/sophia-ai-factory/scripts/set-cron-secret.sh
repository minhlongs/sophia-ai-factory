#!/bin/bash
# set-cron-secret.sh — One-time operator setup for cron authentication.
#
# WHEN TO RUN:
#   Run this script ONCE before the next deploy after the security hardening
#   that removed the x-cf-cron bypass (2026-05-02).
#   If CRON_SECRET is not set in Cloudflare Workers secrets, all scheduled
#   cron jobs will return 401 and stop firing after the next deploy.
#
# USAGE:
#   bash apps/sophia-ai-factory/scripts/set-cron-secret.sh
#
# REQUIREMENTS:
#   - wrangler must be installed (npx wrangler works)
#   - Must be authenticated with Cloudflare (wrangler login)
#   - Must have write access to the sophia-ai-factory Worker secrets
#
# IDEMPOTENT: safe to run again — generates a new secret each time.
# After running, deploy must be triggered for the runtime to pick up the new secret.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_ROOT"

echo "[set-cron-secret] Generating 32-byte random secret..."
SECRET=$(openssl rand -hex 32)

echo "[set-cron-secret] Setting CRON_SECRET in Cloudflare Workers secrets..."
echo "$SECRET" | npx wrangler secret put CRON_SECRET

echo ""
echo "[set-cron-secret] Done."
echo "  Secret length: ${#SECRET} chars"
echo "  Next step: deploy the Worker so the runtime picks up the new secret."
echo "  (git push origin main — GitHub Actions will handle the deploy)"
