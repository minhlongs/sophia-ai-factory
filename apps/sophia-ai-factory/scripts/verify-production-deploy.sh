#!/bin/bash
# Verify that the live Cloudflare Worker is serving the current git commit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

PROD_URL="${PROD_URL:-https://sophia.agencyos.network}"
LOCAL_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD | cut -c1-8)"
VERIFY_URL="$PROD_URL/api/version?deployVerify=$LOCAL_SHA"

echo "==> verify-production-deploy"
echo "Production: $PROD_URL"
echo "Local SHA: $LOCAL_SHA"

VERSION_JSON="$(curl -fsS "$VERIFY_URL")"
LIVE_SHA="$(printf '%s' "$VERSION_JSON" | sed -n 's/.*"shortSha"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

if [ -z "$LIVE_SHA" ]; then
  echo "ERROR: unable to parse shortSha from $VERIFY_URL"
  printf '%s\n' "$VERSION_JSON"
  exit 1
fi

echo "Live SHA:  $LIVE_SHA"

if [ "$LOCAL_SHA" != "$LIVE_SHA" ]; then
  echo "ERROR: deploy SHA mismatch. Production is stale or serving a different artifact."
  exit 1
fi

HTTP_STATUS="$(curl -fsS -o /dev/null -w '%{http_code}' "$PROD_URL")"
echo "HTTP:      $HTTP_STATUS"

if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: production root did not return HTTP 200."
  exit 1
fi

echo "Production deploy verified."
