#!/bin/bash

# setup-vercel.sh
# Automates Vercel project linking and environment setup

set -e

echo "🚀 Setting up Vercel Project..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if already linked
if [ -d ".vercel" ]; then
    echo "✅ Project already linked (.vercel directory exists)"
else
    echo "🔗 Linking Vercel project..."
    # Attempt to link (requires login)
    vercel link --yes
fi

# Pull Environment Variables
echo "📥 Pulling environment variables..."
vercel env pull .env.local --yes || echo "⚠️ Failed to pull env vars. You might need to log in 'vercel login'"

echo "✅ Vercel setup complete!"
