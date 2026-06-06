#!/bin/bash
# apply-migrations.sh — Apply canonical D1 migrations changed since a git ref.
# Usage: bash scripts/apply-migrations.sh [REF]
# REF: git ref to compare against HEAD (default: HEAD~1)
# Example: bash scripts/apply-migrations.sh HEAD~3
set -euo pipefail

REF="${1:-HEAD~1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

DB_NAME="${DB_NAME:-sophia-raas-db}"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-wrangler.toml}"
WRANGLER_REMOTE_FLAG="${WRANGLER_REMOTE_FLAG:---remote}"
WRANGLER_SCOPE_ARGS=()
if [ -n "$WRANGLER_REMOTE_FLAG" ]; then
  WRANGLER_SCOPE_ARGS+=("$WRANGLER_REMOTE_FLAG")
fi

echo "==> Checking for migrations changed since $REF..."
# --relative emits paths relative to CWD (apps/sophia-ai-factory/) so the
# `[ -f "$m" ]` check + `wrangler --file=$m` resolve correctly. Without it,
# git returns repo-root-relative paths (apps/sophia-ai-factory/migrations/...)
# which double up after the `cd "$SCRIPT_DIR/.."` above.
MIGRATIONS=$(git diff --name-only --relative "$REF" HEAD -- migrations/ 2>/dev/null | grep -E "\.sql$" | sort || true)
NON_CANONICAL_D1_SQL=$(git diff --name-only --relative "$REF" HEAD -- src/seed/db/migrations/ 2>/dev/null | grep -E "\.sql$" | sort || true)

if [ -n "$NON_CANONICAL_D1_SQL" ]; then
  echo "❌ Refusing to apply non-canonical D1 migration files."
  echo "Move these SQL files into migrations/ or document why they are not production D1 migrations:"
  printf '%s\n' "$NON_CANONICAL_D1_SQL"
  exit 2
fi

if [ -z "$MIGRATIONS" ]; then
  echo "No new migrations to apply."
  exit 0
fi

echo "==> Migrations to apply:"
echo "$MIGRATIONS"
echo ""

for m in $MIGRATIONS; do
  if [ ! -f "$m" ]; then
    echo "⚠️ File not found (may have been deleted): $m — skipping"
    continue
  fi

  # Guard: skip migrations already recorded in D1's _migrations table.
  # Uses --file with temp SQL to avoid --command hanging in non-interactive mode.
  MIGRATION_NAME=$(basename "$m" .sql)
  TMP_SQL=$(mktemp /tmp/migration-check-XXXXXX.sql)
  echo "SELECT COUNT(*) AS cnt FROM _migrations WHERE name = '${MIGRATION_NAME}'" > "$TMP_SQL"
  APPLIED_COUNT=$(npx wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    --remote \
    --file="$TMP_SQL" \
    2>/dev/null | grep -o '"cnt":[0-9]*' | cut -d: -f2 || echo "0")
  rm -f "$TMP_SQL"

  if [ "${APPLIED_COUNT:-0}" -gt 0 ]; then
    echo "⏭️ ${MIGRATION_NAME} already applied — skipping"
    continue
  fi

  echo "==> Applying ${MIGRATION_NAME} to ${DB_NAME}"
  npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --file="$m" "${WRANGLER_SCOPE_ARGS[@]}"
done

echo ""
echo "✅ All migrations applied."
