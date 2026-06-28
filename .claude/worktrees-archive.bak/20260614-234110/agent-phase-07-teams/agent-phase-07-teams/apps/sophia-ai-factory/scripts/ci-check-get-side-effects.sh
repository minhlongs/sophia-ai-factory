#!/usr/bin/env bash
# CI check: flag GET API routes that may have side effects (DB writes).
# Scans for direct D1 write calls in GET handlers.
set -euo pipefail

FAIL=0
GET_ROUTES=$(find src/app/api -name "route.ts" -exec grep -l "export async function GET" {} \;)

has_get_write() {
  local route="$1"
  sed -n '/export async function GET/,/^export async function/p' "$route" \
    | grep -E "\\.(insert|update|delete|upsert)\\s*\\(|\\.prepare\\s*\\(\\s*['\\\"](INSERT|UPDATE|DELETE|MERGE)" \
    | grep -v '// ' \
    | grep -v '\*' \
    | grep -v 'listPublishedListings\|listBatchJobs\|getBatchJob\|getBatchVideos\|getInstallation\|getTemplateBySlug\|getListingByTemplateId\|getUserLicense\|getTemplateById\|\.first\s*<' || true
}

is_protected_mutating_get() {
  local route="$1"
  local content
  content=$(cat "$route")

  case "$route" in
    src/app/api/cron/*)
      grep -q "verifyCronAuth" "$route"
      return
      ;;
    src/app/api/oauth/*/callback/route.ts)
      grep -Eq "verifyState|consumeOauthState" "$route" && grep -q "getCurrentUserFromHeaders" "$route"
      return
      ;;
    src/app/api/r/*/route.ts)
      grep -q "isValidShortCode" "$route" && grep -q "checkRateLimit" "$route"
      return
      ;;
    src/app/api/v1/creative-studio/images/*/status/route.ts|src/app/api/heygen/status/*/route.ts)
      grep -q "getCurrentUser" "$route" && grep -Eq "user_id.*user\\.id|owner.*user\\.id|eq\\(['\"]user_id['\"], user\\.id\\)" "$route"
      return
      ;;
  esac

  echo "$content" | grep -q "@allow-mutating-get"
}

for route in $GET_ROUTES; do
  # Look for write patterns inside the GET handler block
  # We extract the GET function body and check for writes
  WRITES=$(has_get_write "$route")

  if [ -n "$WRITES" ]; then
    if is_protected_mutating_get "$route"; then
      continue
    fi

    echo "⚠️  $route — potential write in GET handler:"
    echo "$WRITES" | sed 's/^/    /'
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "❌ GET routes with potential side effects detected. Review above."
  exit 1
fi

echo "✅ No GET routes with DB write side effects found."
