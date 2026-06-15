#!/bin/bash
# audit-r2-lifecycle.sh — R2 Bucket Lifecycle Policy Audit
# Verifies: sophia-ai-factory-opennext-cache has correct retention rules
# Output: Lifecycle status + recommendations

set -e

BUCKET="sophia-ai-factory-opennext-cache"
OUTPUT_DIR="$(pwd)/audit-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGFILE="${OUTPUT_DIR}/audit-r2-lifecycle-${TIMESTAMP}.log"

# Create output directory
mkdir -p "${OUTPUT_DIR}"

{
  echo "==================================="
  echo "R2 Bucket Lifecycle Audit"
  echo "Bucket: ${BUCKET}"
  echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "==================================="
  echo ""

  # Check wrangler authentication
  echo "--- Checking Wrangler Authentication ---"
  if npx wrangler whoami >/dev/null 2>&1; then
    echo "✅ Authenticated to Cloudflare"
  else
    echo "❌ ERROR: Not authenticated to Cloudflare"
    echo "   Run: npx wrangler login"
    exit 1
  fi
  echo ""

  # Get bucket info
  echo "--- Bucket Information ---"
  if npx wrangler r2 bucket info "${BUCKET}" 2>/dev/null; then
    echo "✅ Bucket exists"
  else
    echo "❌ ERROR: Bucket not found"
    exit 1
  fi
  echo ""

  # Check lifecycle rules
  echo "--- Current Lifecycle Rules ---"
  LIFECYCLE=$(npx wrangler r2 bucket info "${BUCKET}" 2>/dev/null | grep -i "lifecycle" || echo "")
  if [ -z "$LIFECYCLE" ]; then
    echo "⚠️  WARNING: No lifecycle rules configured"
    echo ""
    echo "RECOMMENDED ACTIONS:"
    echo "1. Delete objects older than 30 days:"
    echo "   npx wrangler r2 bucket lifecycle put \\"
    echo "     --bucket-name ${BUCKET} \\"
    echo "     --rules '[{\"filter\":{\"prefix\":\"\"},\"deleteAfterDays\":30}]'"
    echo ""
    echo "2. Delete health-check files older than 7 days:"
    echo "   npx wrangler r2 bucket lifecycle put \\"
    echo "     --bucket-name ${BUCKET} \\"
    echo "     --rules '[{\"filter\":{\"prefix\":\"health-check\"},\"deleteAfterDays\":7}]'"
  else
    echo "$LIFECYCLE"
    echo "✅ Lifecycle rules detected"
  fi
  echo ""

  # Sample bucket objects
  echo "--- Sample Objects (first 10) ---"
  npx wrangler r2 object list "${BUCKET}" --limit 10 2>/dev/null | head -20 || echo "No objects or access denied"
  echo ""

  echo "==================================="
  echo "Checklist:"
  echo "☐ 30-day cache expiration enabled"
  echo "☐ 7-day health-check rotation enabled"
  echo "☐ Lifecycle policy tested in dev environment"
  echo "☐ Verified with audit script monthly"
  echo "==================================="
} | tee "${LOGFILE}"

echo "Lifecycle audit report saved: ${LOGFILE}"
