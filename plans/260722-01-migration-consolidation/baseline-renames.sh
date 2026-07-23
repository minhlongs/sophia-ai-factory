#!/usr/bin/env bash
# Baseline renames — archive duplicate/legacy migration files.
# Wrangler/D1 is NOT touched.
set -euo pipefail
MIGRATIONS_DIR="/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/migrations"
BACKUP_DIR="$MIGRATIONS_DIR/_archive/260722-baseline-duplicates"
mkdir -p "$BACKUP_DIR"
ls -1 "$MIGRATIONS_DIR" | grep -E '^(0004|0005|0031|0032|0033|0034|0100|0118|0178|0179|0212|0213|0214|0215)' | head -20
