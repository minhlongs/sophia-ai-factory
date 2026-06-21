#!/bin/bash
# verify-otel.sh — Verify OpenTelemetry traces are flowing to Honeycomb
# Usage: bash scripts/verify-otel.sh [staging|production]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENVIRONMENT="${1:-staging}"
URL=""
DATASET=""
WORKER=""

case "$ENVIRONMENT" in
  staging)
    URL="https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev"
    DATASET="sophia-staging"
    WORKER="sophia-ai-factory-staging"
    ;;
  production)
    URL="https://sophia.agencyos.network"
    DATASET="sophia-prod"
    WORKER="sophia-ai-factory"
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    echo "Usage: $0 [staging|production]"
    exit 1
    ;;
esac

cd "$APP_DIR"

echo "=== OTEL Verification for $ENVIRONMENT ==="
echo ""
echo "URL: $URL"
echo "Dataset: $DATASET"
echo "Worker: $WORKER"
echo ""

# Check 1: Worker is responding
echo "[1/5] Checking worker health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/version")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Worker is healthy (HTTP $HTTP_CODE)"
  curl -s "$URL/api/version" | jq -r '.shortSha, .deployedAt' 2>/dev/null || echo "SHA: $(curl -s $URL/api/version | grep -o '\"[^\"]*\"' | head -1)"
else
  echo "❌ Worker returned HTTP $HTTP_CODE"
  exit 1
fi
echo ""

# Check 2: HONEYCOMB_API_KEY secret is set
echo "[2/5] Checking HONEYCOMB_API_KEY secret..."
if npx wrangler secret list --config "wrangler.$ENVIRONMENT.toml" --name "$WORKER" 2>/dev/null | grep -q "HONEYCOMB_API_KEY"; then
  echo "✅ HONEYCOMB_API_KEY secret is set"
else
  echo "❌ HONEYCOMB_API_KEY secret NOT found"
  echo "   Run: bash scripts/setup-honeycomb.sh $ENVIRONMENT"
  exit 1
fi
echo ""

# Check 3: Generate test traffic
echo "[3/5] Generating test traffic (10 requests)..."
for i in {1..10}; do
  curl -s "$URL/en" > /dev/null &
done
wait
echo "✅ Test traffic generated"
echo ""

# Check 4: Verify OTEL is initialized (check worker logs for OTel messages)
echo "[4/5] Checking worker logs for OTel initialization..."
# Note: wrangler tail may show recent logs; look for OTel init message
if npx wrangler tail --config "wrangler.$ENVIRONMENT.toml" --name "$WORKER" 2>/dev/null | grep -i "otel\|opentelemetry" | head -5 | grep -q "initialized\|OTel"; then
  echo "✅ OTel initialization detected in logs"
else
  echo "⚠️  No explicit OTel log messages (this is OK if samplerate is low)"
fi
echo ""

# Check 5: Instructions for Honeycomb verification
echo "[5/5] Manual verification in Honeycomb UI required:"
echo ""
echo "1. Go to https://ui.honeycomb.io"
echo "2. Select dataset: $DATASET"
echo "3. Go to Traces tab"
echo "4. Set time range to 'Last 5 minutes'"
echo "5. Run query: COUNT() where service_name contains 'sophia'"
echo ""
echo "If traces appear: ✅ OTEL is working!"
echo "If no traces:"
echo "   - Verify HONEYCOMB_API_KEY is valid (not expired)"
echo "   - Check worker logs for OTel export errors"
echo "   - Increase OTEL_SAMPLERATE to 1.0 in wrangler.toml [vars]"
echo "   - Re-deploy and retry"
echo ""

echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. If traces visible, import Honeycomb dashboard:"
echo "   docs/honeycomb-configuration.md"
echo "2. Configure alert rules as specified"
echo "3. Update runbook with any environment-specific details"
echo ""
