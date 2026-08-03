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

# ─── Post-flight schema verification ─────────────────────────────────────────
# Maps migration basename (no .sql) -> verification SQL (run after migration).
# Each query must return a non-empty result set on success.
# Verification failures are logged as warnings — they never block deployment.
declare -a VERIFY_AFTER=()

add_verify() {
  # Usage: add_verify "migration-basename" "SELECT col FROM table WHERE ..."
  VERIFY_AFTER+=("$1|$2")
}

# ── Table-rebuild migrations: verify new table exists ──
add_verify "0047-user-purchases-underpaid" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='user_purchases'"
add_verify "0087-subscriptions-drop-user-id-fk" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='subscriptions'"
add_verify "0088-org-members-drop-user-id-fk" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='org_members'"
add_verify "0089-videos-drop-user-id-fk" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='videos'"
add_verify "0090-publisher-add-facebook-twitter" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='publishing_channels'"
add_verify "0094-publisher-add-distribution-platforms" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='publishing_channels'"
add_verify "0100-telegram-pairing-unique-paired-by" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_paired_chats'"
add_verify "0116-fix-user-sop-installations-template-fk" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='user_sop_installations'"

# ── RENAME COLUMN migrations: verify table still exists ──
add_verify "0140_fix_campaign_checkpoints_columns" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_checkpoints'"

# ── Feature migrations: verify key tables added ──
add_verify "0059-sop-config-schema" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='sop_templates'"
add_verify "0101-publishing-jobs-rename-video-job-id-to-video-id" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='publishing_jobs'"

# ─── Helper: run a verification query against D1 ─────────────────────────────
run_verify() {
  local migration_name="$1"
  local verify_sql="$2"
  local tmp_sql
  tmp_sql=$(mktemp -t migration-verify)
  echo "$verify_sql" > "$tmp_sql"
  local output
  output=$(npx wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    --remote \
    --file="$tmp_sql" 2>/dev/null || true)
  rm -f "$tmp_sql"

  # Pass if output has non-empty results array
  if echo "$output" | grep -q '"results":\s*\[' && ! echo "$output" | grep -qP '"results":\s*\[\s*\]'; then
    return 0
  elif echo "$output" | grep -qE '"results":\s*\[\s*\]'; then
    return 1
  elif echo "$output" | grep -qi "error"; then
    return 1
  fi
  if echo "$output" | grep -qE '\[.*\{.*\}'; then
    return 0
  fi
  return 1
}

# ─── Pre-execution guard: sqlite_master existence check for DROP/RENAME ──────
# For migrations using DROP TABLE or ALTER TABLE RENAME, verify referenced tables
# exist in sqlite_master before executing. If missing, skip with warning.
# This makes re-runs idempotent-safe without editing individual migration files.
guard_drop_rename() {
  local migration_file="$1"
  local tmp_guard_sql
  tmp_guard_sql=$(mktemp -t migration-guard)

  local tables_to_check=()
  while IFS= read -r line; do
    local tbl=""
    # Match: DROP TABLE <name>;  (with or without IF EXISTS)
    tbl=$(echo "$line" | grep -oP '(?<=DROP TABLE\s)(\S+)' | tr -d ';' | tr -d ' ' || true)
    if [ -n "$tbl" ]; then
      tables_to_check+=("$tbl")
    fi
    # Match: ALTER TABLE <old> RENAME TO <new>;
    tbl=$(echo "$line" | grep -oP '(?<=ALTER TABLE\s)(\S+)' | tr -d ';' | tr -d ' ' || true)
    if [ -n "$tbl" ]; then
      tables_to_check+=("$tbl")
    fi
  done < "$migration_file"

  if [ "${#tables_to_check[@]}" -eq 0 ]; then
    rm -f "$tmp_guard_sql"
    return 0
  fi

  local where_clauses=()
  for tbl in "${tables_to_check[@]}"; do
    where_clauses+=("(name = '${tbl}' AND type = 'table')")
  done
  local combined_where
  combined_where=$(IFS=' OR '; echo "${where_clauses[*]}")

  cat > "$tmp_guard_sql" <<EOSQL
SELECT COUNT(*) AS cnt FROM sqlite_master
WHERE ${combined_where};
EOSQL

  local count
  count=$(npx wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    --remote \
    --file="$tmp_guard_sql" 2>/dev/null \
    | grep -o '"cnt":[0-9]*' | cut -d: -f2 || echo "0")
  rm -f "$tmp_guard_sql"

  local expected=${#tables_to_check[@]}
  if [ "${count:-0}" -lt "$expected" ]; then
    echo "WARNING: Pre-flight guard: ${expected} table(s) in DROP/RENAME not found in sqlite_master."
    echo "   Tables checked: ${tables_to_check[*]}"
    echo "   Tables found:   ${count}"
    echo "   -> Skipping migration (safe: tables likely already rebuilt by prior run)."
    return 1
  fi
  return 0
}

echo "==> Checking for migrations changed since $REF..."
# --relative emits paths relative to CWD (apps/sophia-ai-factory/) so the
# [ -f "$m" ] check + wrangler --file=$m resolve correctly.
MIGRATIONS=$(git diff --name-only --relative "$REF" HEAD -- migrations/ 2>/dev/null | grep -E "\.sql$" | sort || true)
NON_CANONICAL_D1_SQL=$(git diff --name-only --relative "$REF" HEAD -- src/seed/db/migrations/ 2>/dev/null | grep -E "\.sql$" | sort || true)
if [ -n "$NON_CANONICAL_D1_SQL" ]; then
  echo "ERROR: Refusing to apply non-canonical D1 migration files."
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

APPLIED_COUNT=0
SKIPPED_COUNT=0

for m in $MIGRATIONS; do
  if [ ! -f "$m" ]; then
    echo "WARNING: File not found (may have been deleted): $m — skipping"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  MIGRATION_NAME=$(basename "$m" .sql)

  # Guard: skip migrations already recorded in D1 d1_migrations table
  TMP_SQL=$(mktemp -t migration-check)
  echo "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name = '${MIGRATION_NAME}'" > "$TMP_SQL"
  APPLIED_COUNT_DB=$(npx wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    --remote \
    --file="$TMP_SQL" \
    2>/dev/null | grep -o '"cnt":[0-9]*' | cut -d: -f2 || echo "0")
  rm -f "$TMP_SQL"
  if [ "${APPLIED_COUNT_DB:-0}" -gt 0 ]; then
    echo "SKIPPED: ${MIGRATION_NAME} already applied"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  # Pre-flight guard for DROP/RENAME pattern migrations
  if ! guard_drop_rename "$m"; then
    echo "SKIPPED: ${MIGRATION_NAME} — sqlite_master guard (tables not present)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  echo "==> Applying ${MIGRATION_NAME} to ${DB_NAME}"
  if ! npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --file="$m" "${WRANGLER_SCOPE_ARGS[@]}"; then
    echo "ERROR: ${MIGRATION_NAME} FAILED — aborting deployment to prevent schema divergence"

  exit 1
fi
