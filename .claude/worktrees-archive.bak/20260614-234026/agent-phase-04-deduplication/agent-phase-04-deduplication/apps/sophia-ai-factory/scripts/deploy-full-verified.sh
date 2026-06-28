#!/bin/bash
# Deploy the current Cloudflare Worker artifact, then verify the live user path.
#
# This intentionally runs the browser gate after deploy so it validates the
# newly published artifact, not the previous production worker.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

if [ "${ALLOW_DIRTY_DEPLOY:-0}" != "1" ]; then
  if [ -n "$(git -C "$APP_DIR/../.." status --porcelain)" ]; then
    echo "ERROR: working tree is dirty. Commit or stash before deploy:full."
    echo "Set ALLOW_DIRTY_DEPLOY=1 only for an emergency deploy with explicit operator approval."
    git -C "$APP_DIR/../.." status --short
    exit 1
  fi
fi

if [ -z "${E2E_TEST_USER_PASSWORD:-}" ]; then
  echo "ERROR: E2E_TEST_USER_PASSWORD is required before deploy:full."
  echo "Bootstrap/verify the production E2E user first:"
  echo "  PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network E2E_TEST_USER_PASSWORD='<strong-password>' npm run e2e:bootstrap-user"
  exit 1
fi

./scripts/deploy-with-sha.sh
npm run test:e2e:go-live
./scripts/verify-production-deploy.sh
