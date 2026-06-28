#!/usr/bin/env bash
#
# verify-d1-backup.sh — Integrity check for Sophia D1 schema vs migrations/
#
# Reads the remote D1 schema via wrangler, lists tables, and diffs against the
# local migrations directory (concatenated). Exits 0 if expected drift only
# (in-flight migrations), exits 1 on unexpected drift.
#
# NO RESTORE is performed by this script — read-only inspection only.
# Doctrine note: backup STRATEGY is R2 lifecycle (30-day retention on
# `sophia-backups` bucket). This script is a drift detector, not a recovery
# tool.
#
# Usage:
#   bash scripts/verify-d1-backup.sh
#
# Output:
#   /tmp/sophia-d1-prod-schema.sql  — remote schema dump (DDL only, no data)
#   /tmp/sophia-d1-prod-tables.txt  — table list
#   stdout — table count + drift summary
#
# Requirements: wrangler CLI authenticated; current working dir must contain wrangler.toml
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v npx >/dev/null 2>&1; then
  echo "❌ npx not found — install Node.js"
  exit 2
fi

if [ ! -f wrangler.toml ]; then
  echo "❌ wrangler.toml not found in $(pwd) — run from apps/sophia-ai-factory/"
  exit 2
fi

DB_NAME="sophia-raas-db"
SCHEMA_DUMP="/tmp/sophia-d1-prod-schema.sql"
TABLE_LIST="/tmp/sophia-d1-prod-tables.txt"

echo "=== Sophia D1 Backup Integrity Check ==="
echo "Database: ${DB_NAME}"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Step 1: export remote schema (DDL only — no PII risk)
echo "→ Exporting remote schema (DDL only)..."
npx wrangler d1 execute "${DB_NAME}" --remote --command ".schema" \
  > "${SCHEMA_DUMP}" 2>&1 || {
    echo "❌ Failed to export remote schema. Check wrangler auth + DB binding."
    exit 1
  }

SCHEMA_BYTES=$(wc -c <"${SCHEMA_DUMP}" | tr -d ' ')
echo "✅ Schema exported (${SCHEMA_BYTES} bytes) → ${SCHEMA_DUMP}"

# Step 2: list tables
echo "→ Listing remote tables..."
npx wrangler d1 execute "${DB_NAME}" --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;" \
  2>/dev/null | grep -oE '"[a-z_][a-z_0-9]*"' | tr -d '"' | sort -u > "${TABLE_LIST}" || true

TABLE_COUNT=$(wc -l <"${TABLE_LIST}" | tr -d ' ')
echo "✅ Remote tables: ${TABLE_COUNT} → ${TABLE_LIST}"

# Step 3: compare against migrations/
if [ ! -d migrations ]; then
  echo "⚠ migrations/ directory not found — skipping diff"
  exit 0
fi

MIGRATION_TABLES=$(grep -hiE 'CREATE TABLE( IF NOT EXISTS)?' migrations/*.sql 2>/dev/null \
  | sed -E 's/.*CREATE TABLE( IF NOT EXISTS)? +`?([a-z_][a-z_0-9]*)`?.*/\2/i' \
  | sort -u || true)

if [ -z "${MIGRATION_TABLES}" ]; then
  echo "⚠ No CREATE TABLE statements parsed from migrations/ — manual review needed"
  exit 0
fi

# Tables in remote but not in migrations
echo ""
echo "=== Drift Report ==="
REMOTE_ONLY=$(comm -23 "${TABLE_LIST}" <(echo "${MIGRATION_TABLES}") || true)
MIGRATIONS_ONLY=$(comm -13 "${TABLE_LIST}" <(echo "${MIGRATION_TABLES}") || true)

if [ -z "${REMOTE_ONLY}" ] && [ -z "${MIGRATIONS_ONLY}" ]; then
  echo "✅ No drift — remote tables match migrations/"
  exit 0
fi

if [ -n "${REMOTE_ONLY}" ]; then
  echo "⚠ Tables in remote but NOT in migrations/ (may be CF system tables or in-flight):"
  echo "${REMOTE_ONLY}" | sed 's/^/    /'
fi

if [ -n "${MIGRATIONS_ONLY}" ]; then
  echo "⚠ Tables in migrations/ but NOT yet in remote (likely unapplied migration):"
  echo "${MIGRATIONS_ONLY}" | sed 's/^/    /'
fi

echo ""
echo "ℹ Drift during in-flight migration windows is EXPECTED."
echo "ℹ Run: bash scripts/apply-migrations.sh   to apply pending migrations."
echo ""
exit 1
