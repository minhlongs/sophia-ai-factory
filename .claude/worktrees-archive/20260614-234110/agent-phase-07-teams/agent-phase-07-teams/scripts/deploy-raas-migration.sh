#!/bin/bash

# ============================================================================
# Script: deploy-raas-migration.sh
# Purpose: Deploy Redis → Supabase migration for RaaS License System
# Date: 2026-03-06
# Version: 1.0.0
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SQL_FILE="$PROJECT_ROOT/apps/sophia-ai-factory/docs/migrations/raas-licenses-schema.sql"
MIGRATION_SCRIPT="$SCRIPT_DIR/migrate-redis-to-supabase.ts"

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# ============================================================================
# Step 1: Prerequisites Check
# ============================================================================

check_prerequisites() {
    log_info "=== Step 1: Checking Prerequisites ==="

    # Check required commands
    check_command "npx"
    check_command "psql"

    # Check SQL file exists
    if [ ! -f "$SQL_FILE" ]; then
        log_error "SQL migration file not found: $SQL_FILE"
        exit 1
    fi

    log_success "All prerequisites checked"
}

# ============================================================================
# Step 2: Link Supabase Project
# ============================================================================

link_supabase_project() {
    log_info "=== Step 2: Linking Supabase Project ==="

    # Get project ref from user
    echo ""
    read -p "Enter your Supabase project ref (e.g., abcdefghijklmnop): " PROJECT_REF

    if [ -z "$PROJECT_REF" ]; then
        log_error "Project ref cannot be empty"
        exit 1
    fi

    log_info "Linking project: $PROJECT_REF"

    # Login if not already logged in
    log_info "Checking Supabase login status..."
    if ! npx supabase whoami &> /dev/null; then
        log_warning "Not logged in to Supabase. Opening browser..."
        npx supabase login
    fi

    # Link project
    log_info "Linking to Supabase project..."
    npx supabase link --project-ref "$PROJECT_REF"

    log_success "Supabase project linked successfully"
}

# ============================================================================
# Step 3: Execute SQL Migration
# ============================================================================

execute_sql_migration() {
    log_info "=== Step 3: Executing SQL Migration ==="

    log_info "Reading SQL file: $SQL_FILE"

    # Get database URL
    log_info "Fetching database URL..."
    DB_URL=$(npx supabase db url 2>/dev/null)

    if [ -z "$DB_URL" ]; then
        log_error "Failed to get database URL. Is the project linked?"
        exit 1
    fi

    # Execute SQL
    log_info "Executing SQL migration..."
    psql "$DB_URL" -f "$SQL_FILE"

    log_success "SQL migration executed successfully"
}

# ============================================================================
# Step 4: Verify Tables Created
# ============================================================================

verify_tables() {
    log_info "=== Step 4: Verifying Tables Created ==="

    DB_URL=$(npx supabase db url 2>/dev/null)

    # Check raas_licenses table
    log_info "Checking raas_licenses table..."
    LICENSES_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM raas_licenses;" 2>/dev/null | tr -d ' ')

    if [ -z "$LICENSES_COUNT" ]; then
        log_error "Failed to query raas_licenses table"
        exit 1
    fi

    log_success "raas_licenses table exists (rows: $LICENSES_COUNT)"

    # Check raas_audit_logs table
    log_info "Checking raas_audit_logs table..."
    AUDIT_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM raas_audit_logs;" 2>/dev/null | tr -d ' ')

    if [ -z "$AUDIT_COUNT" ]; then
        log_error "Failed to query raas_audit_logs table"
        exit 1
    fi

    log_success "raas_audit_logs table exists (rows: $AUDIT_COUNT)"

    # Verify indexes
    log_info "Verifying indexes..."
    INDEX_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('raas_licenses', 'raas_audit_logs');" 2>/dev/null | tr -d ' ')

    log_success "Found $INDEX_COUNT indexes"

    # Verify RLS policies
    log_info "Verifying RLS policies..."
    POLICY_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('raas_licenses', 'raas_audit_logs');" 2>/dev/null | tr -d ' ')

    log_success "Found $POLICY_COUNT RLS policies"
}

# ============================================================================
# Step 5: Run Data Migration (Optional)
# ============================================================================

run_data_migration() {
    log_info "=== Step 5: Data Migration from Redis (Optional) ==="

    echo ""
    read -p "Do you want to migrate existing Redis data? (y/N): " MIGRATE_REDIS

    if [[ ! "$MIGRATE_REDIS" =~ ^[Yy]$ ]]; then
        log_warning "Skipping Redis data migration"
        return 0
    fi

    # Check if migration script exists
    if [ ! -f "$MIGRATION_SCRIPT" ]; then
        log_error "Migration script not found: $MIGRATION_SCRIPT"
        exit 1
    fi

    # Check Redis env vars
    echo ""
    log_info "Redis data migration requires:"
    echo "  - UPSTASH_REDIS_REST_URL"
    echo "  - UPSTASH_REDIS_REST_TOKEN"
    echo ""

    if [ -z "$UPSTASH_REDIS_REST_URL" ]; then
        read -p "Enter UPSTASH_REDIS_REST_URL: " UPSTASH_REDIS_REST_URL
        export UPSTASH_REDIS_REST_URL
    fi

    if [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
        read -sp "Enter UPSTASH_REDIS_REST_TOKEN: " UPSTASH_REDIS_REST_TOKEN
        export UPSTASH_REDIS_REST_TOKEN
        echo ""
    fi

    log_info "Running data migration script..."
    npx tsx "$MIGRATION_SCRIPT"

    log_success "Data migration completed"
}

# ============================================================================
# Step 6: Verify API Endpoints
# ============================================================================

verify_api() {
    log_info "=== Step 6: Verifying API Endpoints ==="

    echo ""
    log_info "To verify API endpoints, you need:"
    echo "  1. Deploy the code changes (git push)"
    echo "  2. Set environment variables on Cloudflare dashboard (Workers & Pages > Settings > Variables):"
    echo "     - SUPABASE_URL"
    echo "     - SUPABASE_SERVICE_ROLE_KEY"
    echo "     - RAAS_LICENSE_SECRET"
    echo ""

    read -p "Enter your production URL (default: https://sophia.agencyos.network): " PROD_URL
    PROD_URL="${PROD_URL:-https://sophia.agencyos.network}"

    read -p "Enter admin username (default: admin): " ADMIN_USER
    ADMIN_USER="${ADMIN_USER:-admin}"

    echo -n "Enter admin password: "
    read -s ADMIN_PASS
    echo ""

    # Create auth header
    AUTH_HEADER=$(echo -n "$ADMIN_USER:$ADMIN_PASS" | base64)

    log_info "Testing GET /api/admin/licenses..."
    curl -s -H "Authorization: Basic $AUTH_HEADER" "$PROD_URL/api/admin/licenses" | head -c 500
    echo ""

    log_success "API verification complete"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    echo ""
    echo "============================================"
    echo "  RaaS License Migration: Redis → Supabase"
    echo "============================================"
    echo ""

    check_prerequisites
    link_supabase_project
    execute_sql_migration
    verify_tables
    run_data_migration
    verify_api

    echo ""
    log_success "============================================"
    log_success "  Migration Completed Successfully!"
    log_success "============================================"
    echo ""
    log_info "Next steps:"
    echo "  1. Update .env.local with SUPABASE_SERVICE_ROLE_KEY"
    echo "  2. Set environment variables on Cloudflare dashboard"
    echo "  3. Deploy: git push origin main"
    echo "  4. Verify production: curl https://sophia.agencyos.network"
    echo ""
}

# Run main function
main
