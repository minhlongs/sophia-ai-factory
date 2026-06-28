#!/usr/bin/env bash
# Operator script: generate and set CREDENTIALS_MASTER_KEY
# Run ONCE before first deployment. Store output in Cloudflare Workers secrets.
#
# Usage:
#   chmod +x scripts/set-credentials-master-key.sh
#   ./scripts/set-credentials-master-key.sh
#
# Then set via wrangler:
#   echo "$KEY" | npx wrangler secret put CREDENTIALS_MASTER_KEY
#
# WARNING: if you regenerate this key all existing user_provider_credentials
# rows become unreadable. Rotate only with a migration plan.

set -euo pipefail

KEY=$(openssl rand -hex 32)
echo ""
echo "Generated CREDENTIALS_MASTER_KEY (64 hex chars = 32 bytes):"
echo "$KEY"
echo ""
echo "To deploy to Cloudflare Workers:"
echo "  echo '$KEY' | npx wrangler secret put CREDENTIALS_MASTER_KEY"
echo ""
echo "NOTE: also set BYOK_MASTER_KEY if not already set (used by user_api_keys table)"
echo "  openssl rand -base64 32 | npx wrangler secret put BYOK_MASTER_KEY"
