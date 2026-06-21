#!/bin/bash
# setup-honeycomb.sh — Configure Honeycomb API key for OTEL
# Usage: bash scripts/setup-honeycomb.sh [staging|production]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENVIRONMENT="${1:-staging}"

echo "=== Honeycomb OTEL Setup for $ENVIRONMENT ==="
echo ""

# Check for API key in environment or prompt
if [ -z "${HONEYCOMB_API_KEY:-}" ]; then
  echo "HONEYCOMB_API_KEY not set in environment."
  echo "Please enter your Honeycomb API key (starts with hny_):"
  read -r API_KEY
else
  API_KEY="$HONEYCOMB_API_KEY"
fi

if [ -z "$API_KEY" ]; then
  echo "Error: API key is required"
  exit 1
fi

# Validate format (Honeycomb keys start with hny_)
if [[ ! "$API_KEY" =~ ^hny_ ]]; then
  echo "Warning: API key doesn't start with hny_ — please verify it's correct"
  read -p "Continue anyway? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

cd "$APP_DIR"

case "$ENVIRONMENT" in
  staging)
    CFG="wrangler.staging.toml"
    WORKER="sophia-ai-factory-staging"
    DATASET="sophia-staging"
    ;;
  production)
    CFG="wrangler.toml"
    WORKER="sophia-ai-factory"
    DATASET="sophia-prod"
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    echo "Usage: $0 [staging|production]"
    exit 1
    ;;
esac

echo ""
echo "Setting HONEYCOMB_API_KEY secret on $ENVIRONMENT ($WORKER)..."
echo "$API_KEY" | npx wrangler secret put HONEYCOMB_API_KEY --config "$CFG" --name "$WORKER"

echo ""
echo "✅ Honeycomb secret configured!"
echo ""
echo "Next steps:"
echo "1. Verify the secret was set:"
echo "   npx wrangler secret list --config $CFG --name $WORKER | grep HONEYCOMB"
echo ""
echo "2. Deploy to $ENVIRONMENT:"
if [ "$ENVIRONMENT" = "staging" ]; then
  echo "   bash scripts/deploy-staging.sh"
else
  echo "   npm run deploy:full"
fi
echo ""
echo "3. Verify traces in Honeycomb:"
echo "   - Dataset: $DATASET"
echo "   - Go to https://ui.honeycomb.io"
echo "   - Check Traces tab for recent spans"
echo ""
echo "4. Import dashboard:"
echo "   docs/honeycomb-configuration.md (contains board JSON)"
echo ""
