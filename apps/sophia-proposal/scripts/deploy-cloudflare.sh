#!/bin/bash
# Deploy to Cloudflare Pages
# Usage: ./scripts/deploy-cloudflare.sh

set -e

echo "=== Deploy to Cloudflare Pages ==="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo "❌ wrangler CLI not found. Install with: npm install -g wrangler"
  exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
  echo "❌ Not logged in to Cloudflare. Run: wrangler login"
  exit 1
fi

# Build
echo "📦 Building Next.js..."
npm run build

# Deploy
echo "🚀 Deploying to Cloudflare Pages..."
wrangler pages deploy .next --project-name=sophia-ai-factory

echo "✅ Deploy complete!"
echo "🌐 Production URL: https://sophia-ai-factory.pages.dev"
