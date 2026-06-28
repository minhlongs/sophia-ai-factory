#!/bin/bash
# Strict production-user E2E gate for Sophia CF-direct deploys.
#
# Required:
#   E2E_TEST_USER_PASSWORD='<password used by npm run e2e:bootstrap-user>'
# Optional:
#   E2E_TEST_USER_EMAIL='e2e-master@sophia.test'
#   PLAYWRIGHT_TEST_BASE_URL='https://sophia.agencyos.network'

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

BASE_URL="${PLAYWRIGHT_TEST_BASE_URL:-https://sophia.agencyos.network}"

if [ -z "${E2E_TEST_USER_PASSWORD:-}" ]; then
  echo "ERROR: E2E_TEST_USER_PASSWORD is required for go-live E2E user GAP gate."
  echo "Bootstrap/verify first:"
  echo "  PLAYWRIGHT_TEST_BASE_URL=$BASE_URL E2E_TEST_USER_PASSWORD='<strong-password>' npm run e2e:bootstrap-user"
  exit 1
fi

export PLAYWRIGHT_TEST_BASE_URL="$BASE_URL"
export E2E_REQUIRE_AUTH=1

echo "==> go-live E2E user GAP gate"
echo "Base URL: $PLAYWRIGHT_TEST_BASE_URL"
echo "User: ${E2E_TEST_USER_EMAIL:-e2e-master@sophia.test}"

npx playwright test tests/e2e/go-live-user-gap.spec.ts --grep @go-live --project=chromium
