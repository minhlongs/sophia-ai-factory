#!/usr/bin/env bash
# CI check: flag GET API routes that may have side effects (DB writes).
# Scans for direct D1 write calls in GET handlers.
set -euo pipefail

FAIL=0
GET_ROUTES=$(find src/app/api -name "route.ts" -exec grep -l "export async function GET" {} \;)

for route in $GET_ROUTES; do
  # Look for write patterns inside the GET handler block
  # We extract the GET function body and check for writes
  WRITES=$(sed -n '/export async function GET/,/^export async function/p' "$route" \
    | grep -E '\.(insert|update|delete|upsert)\s*\(|\.prepare\s*\(\s*[\'"](INSERT|UPDATE|DELETE|MERGE)' \
    | grep -v '// ' | grep -v '\*' | grep -v 'listPublishedListings\|listBatchJobs\|getBatchJob\|getBatchVideos\|getInstallation\|getTemplateBySlug\|getListingByTemplateId\|getUserLicense\|getTemplateById\|\.first\s*<' || true)

  if [ -n "$WRITES" ]; then
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
