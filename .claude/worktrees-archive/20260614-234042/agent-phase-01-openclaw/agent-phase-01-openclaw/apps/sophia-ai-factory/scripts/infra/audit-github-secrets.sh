#!/bin/bash
# audit-github-secrets.sh — GitHub Secrets Inventory & Validation
# Compares actual secrets against required list from docs/infra-hardening.md
# Reports missing, extra, or stale secrets

set -e

REPO="longtho638-jpg/sophia-ai-factory"
OUTPUT_DIR="$(pwd)/audit-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGFILE="${OUTPUT_DIR}/audit-github-secrets-${TIMESTAMP}.log"

# Required secrets from docs/infra-hardening.md
REQUIRED_SECRETS=(
  "CLOUDFLARE_API_TOKEN"
  "CLOUDFLARE_ACCOUNT_ID"
  "SENTRY_AUTH_TOKEN"
  "SENTRY_ORG"
  "SENTRY_PROJECT"
  "BETTER_AUTH_SECRET"
  "NOWPAYMENTS_IPN_SECRET"
  "OPENROUTER_API_KEY"
)

# Rotation schedule (days)
declare -A ROTATION_DAYS=(
  ["CLOUDFLARE_API_TOKEN"]=90
  ["CLOUDFLARE_ACCOUNT_ID"]=0
  ["SENTRY_AUTH_TOKEN"]=90
  ["SENTRY_ORG"]=0
  ["SENTRY_PROJECT"]=0
  ["BETTER_AUTH_SECRET"]=180
  ["NOWPAYMENTS_IPN_SECRET"]=90
  ["OPENROUTER_API_KEY"]=90
)

# Create output directory
mkdir -p "${OUTPUT_DIR}"

{
  echo "==================================="
  echo "GitHub Secrets Audit Report"
  echo "Repository: ${REPO}"
  echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "==================================="
  echo ""

  # Check gh CLI authentication
  echo "--- Checking GitHub Authentication ---"
  if gh auth status >/dev/null 2>&1; then
    echo "✅ Authenticated to GitHub"
  else
    echo "❌ ERROR: Not authenticated to GitHub"
    echo "   Run: gh auth login"
    exit 1
  fi
  echo ""

  # Get list of current secrets
  echo "--- Fetching Current Secrets ---"
  ACTUAL_SECRETS=$(gh secret list --repo "${REPO}" --json name -q '.[].name' 2>/dev/null || echo "")
  if [ -z "$ACTUAL_SECRETS" ]; then
    echo "⚠️  No secrets found or access denied"
    exit 1
  fi
  echo "Found $(echo "$ACTUAL_SECRETS" | wc -l) secret(s)"
  echo ""

  # Convert to array for comparison
  declare -a ACTUAL_ARRAY
  mapfile -t ACTUAL_ARRAY <<<"$ACTUAL_SECRETS"

  # Check required secrets
  echo "--- Required Secrets Check ---"
  MISSING_COUNT=0
  for SECRET in "${REQUIRED_SECRETS[@]}"; do
    if echo "$ACTUAL_SECRETS" | grep -q "^${SECRET}$"; then
      ROTATION="${ROTATION_DAYS[$SECRET]}"
      if [ "$ROTATION" -eq 0 ]; then
        echo "✅ $SECRET (static)"
      else
        echo "✅ $SECRET (rotate every ${ROTATION} days)"
      fi
    else
      echo "❌ MISSING: $SECRET"
      ((MISSING_COUNT++))
    fi
  done
  echo ""

  # Check for extra secrets (not in required list)
  echo "--- Extra/Legacy Secrets ---"
  EXTRA_COUNT=0
  for ACTUAL in "${ACTUAL_ARRAY[@]}"; do
    FOUND=0
    for REQUIRED in "${REQUIRED_SECRETS[@]}"; do
      if [ "$ACTUAL" = "$REQUIRED" ]; then
        FOUND=1
        break
      fi
    done
    if [ $FOUND -eq 0 ]; then
      echo "⚠️  Extra: $ACTUAL (consider removing if legacy)"
      ((EXTRA_COUNT++))
    fi
  done
  if [ $EXTRA_COUNT -eq 0 ]; then
    echo "✅ No extra secrets found"
  fi
  echo ""

  # Summary
  echo "==================================="
  echo "Summary:"
  echo "  Required: ${#REQUIRED_SECRETS[@]}"
  echo "  Actual: ${#ACTUAL_ARRAY[@]}"
  echo "  Missing: $MISSING_COUNT"
  echo "  Extra: $EXTRA_COUNT"
  echo ""
  if [ $MISSING_COUNT -eq 0 ] && [ $EXTRA_COUNT -eq 0 ]; then
    echo "✅ PASS: All secrets configured correctly"
  else
    echo "⚠️  FAIL: Review secrets configuration"
  fi
  echo "==================================="
  echo ""

  # Rotation recommendations
  echo "--- Rotation Schedule (Next 90 Days) ---"
  TODAY=$(date +%s)
  echo "Review these secrets for rotation in next 90 days:"
  for SECRET in "${REQUIRED_SECRETS[@]}"; do
    ROTATION="${ROTATION_DAYS[$SECRET]}"
    if [ "$ROTATION" -gt 0 ]; then
      echo "  - $SECRET (every ${ROTATION} days)"
    fi
  done
  echo ""
  echo "Procedure: Regenerate in provider → Update GitHub → Verify CI/CD GREEN"
  echo ""

} | tee "${LOGFILE}"

echo "Secrets audit report saved: ${LOGFILE}"
exit $MISSING_COUNT
