#!/bin/bash

# infra-sync.sh
# Master script to sync all infrastructure components
# Usage: ./scripts/infra-sync.sh [--ci]

set -e

IS_CI=false
if [[ "$1" == "--ci" ]]; then
    IS_CI=true
fi

echo "🔄 Starting Infrastructure Sync..."

# 1. Cloudflare Setup check
if [ "$IS_CI" = false ]; then
    if command -v wrangler &> /dev/null; then
        echo "✅ Wrangler CLI found. Run 'wrangler login' if not authenticated."
    else
        echo "⚠️ Wrangler CLI not found. Install with: npm install -g wrangler"
    fi
fi

# 3. Supabase Schema Sync
# Checks if we have access to Supabase CLI and project config
if [ -f "supabase/config.toml" ] || [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "🔄 Syncing Supabase Schema..."
    # If running locally and supabase CLI is installed
    if command -v supabase &> /dev/null; then
        # Check if linked
        if [ ! -f "supabase/.temp/project-ref" ] && [ "$IS_CI" = false ]; then
             echo "ℹ️ Supabase project not linked locally. Run 'supabase link' if needed."
        fi

        # We generally don't auto-push to prod in sync script unless explicitly intended
        # But for local dev, 'db push' is useful?
        # Actually, for local dev we usually use 'supabase start'.
        # This script seems more targeted at "Setting up the environment".

        echo "ℹ️ Supabase schema sync skipped in this script to avoid accidental production changes."
        echo "   Run 'supabase db push' manually to apply migrations to remote."
    else
        echo "⚠️ Supabase CLI not found."
    fi
else
    echo "ℹ️ Supabase configuration not found."
fi

echo "✅ Infrastructure Sync Complete!"
