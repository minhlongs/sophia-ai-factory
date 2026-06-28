#!/usr/bin/env bash
# cleanup-magic-link.sh — Remove E2E test fixtures from PROD D1.
# Identifies rows by deterministic HANDOVER_ID and EMAIL (not source='e2e_test'
# because D1 CHECK constraint only allows manual|auto_payment|auto_signup).
# FK direction: customer_handovers.customer_user_id → user.id → delete handover first.
#
# Usage: ./scripts/e2e/cleanup-magic-link.sh

set -euo pipefail

DB_NAME="sophia-raas-db"
EMAIL="e2e-test@sophia.local"
HANDOVER_ID="e2e00000-0000-0000-0000-000000000002"

echo "[cleanup] Removing e2e handover row (id=${HANDOVER_ID})..."
npx wrangler d1 execute "$DB_NAME" --remote --command "
DELETE FROM customer_handovers WHERE id='${HANDOVER_ID}';"

echo "[cleanup] Removing e2e user (email=${EMAIL})..."
npx wrangler d1 execute "$DB_NAME" --remote --command "
DELETE FROM user WHERE email='${EMAIL}';"

echo "[cleanup] Verifying cleanup..."
npx wrangler d1 execute "$DB_NAME" --remote --command "
SELECT count(*) AS remaining FROM customer_handovers WHERE id='${HANDOVER_ID}';"

echo "[cleanup] Done."
