#!/usr/bin/env bash
# seed-magic-link.sh — Seed deterministic E2E test user + handover row in PROD D1.
# Creates user e2e-test@sophia.local and one customer_handovers row.
# source='manual' (CHECK constraint only allows manual|auto_payment|auto_signup).
# Cleanup uses the deterministic HANDOVER_ID / EMAIL to identify and delete rows.
# Outputs magic-link URL to stdout. Idempotent: INSERT OR REPLACE on fixed UUIDs.
#
# Usage: ./scripts/e2e/seed-magic-link.sh
# Cleanup: ./scripts/e2e/cleanup-magic-link.sh

set -euo pipefail

DB_NAME="sophia-raas-db"
BASE_URL="${SOPHIA_BASE_URL:-https://sophia.agencyos.network}"
EMAIL="e2e-test@sophia.local"
USER_ID="e2e00000-0000-0000-0000-000000000001"
HANDOVER_ID="e2e00000-0000-0000-0000-000000000002"
ADMIN_ID="e2e00000-0000-0000-0000-000000000003"

# Pre-flight: confirm wrangler auth
echo "[seed] Checking wrangler auth..."
npx wrangler whoami >/dev/null 2>&1 || { echo "[seed] ERROR: wrangler not authenticated. Run: npx wrangler login"; exit 1; }

# Generate 64-char hex token (matches generateToken() shape: two UUIDs without dashes = 64 hex chars)
TOKEN=$(openssl rand -hex 32)
NOW=$(date +%s)
EXPIRES_AT=$(( NOW + 3600 ))   # 1h TTL (minimal blast radius)

echo "[seed] Seeding user..."
npx wrangler d1 execute "$DB_NAME" --remote --command "
INSERT OR REPLACE INTO user (
  id, email, name, emailVerified, createdAt, updatedAt
) VALUES (
  '${USER_ID}',
  '${EMAIL}',
  'E2E Test User',
  1,
  ${NOW},
  ${NOW}
);"

echo "[seed] Seeding handover..."
npx wrangler d1 execute "$DB_NAME" --remote --command "
INSERT OR REPLACE INTO customer_handovers (
  id,
  customer_user_id,
  agency_name,
  agency_type,
  tier,
  source,
  status,
  created_by_admin_id,
  created_at,
  magic_link_token,
  magic_link_expires_at,
  starter_sops,
  welcome_email_sent_at,
  customer_first_login_at,
  customer_first_sop_install_at,
  customer_first_run_at,
  trigger_payment_id
) VALUES (
  '${HANDOVER_ID}',
  '${USER_ID}',
  'E2E Test Agency',
  'other',
  'BASIC',
  'manual',
  'pending',
  '${ADMIN_ID}',
  ${NOW},
  '${TOKEN}',
  ${EXPIRES_AT},
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
);"

echo "[seed] Verifying token in D1..."
npx wrangler d1 execute "$DB_NAME" --remote --command "
SELECT magic_link_token, magic_link_expires_at FROM customer_handovers WHERE source='e2e_test' LIMIT 1;"

MAGIC_LINK_URL="${BASE_URL}/vi/welcome/${TOKEN}"
echo ""
echo "[seed] MAGIC_LINK_URL=${MAGIC_LINK_URL}"
echo ""
echo "$MAGIC_LINK_URL"
