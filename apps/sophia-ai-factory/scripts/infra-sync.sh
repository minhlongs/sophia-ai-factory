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

# 1. Vercel Setup (Skip in CI if VERCEL_TOKEN provided, Vercel handles its own linking usually)
if [ "$IS_CI" = false ]; then
    if [ -f "./scripts/setup-vercel.sh" ]; then
        ./scripts/setup-vercel.sh
    else
        echo "⚠️ scripts/setup-vercel.sh not found."
    fi
fi

# 2. Polar Product Sync
if [ -n "$POLAR_ACCESS_TOKEN" ]; then
    echo "🔄 Syncing Polar Products..."
    if command -v tsx &> /dev/null; then
        tsx scripts/sync-polar.ts
    else
        npx tsx scripts/sync-polar.ts
    fi
else
    echo "⚠️ POLAR_ACCESS_TOKEN not set. Skipping Polar sync."
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
