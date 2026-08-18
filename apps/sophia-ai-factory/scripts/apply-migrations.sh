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
# NOTE: wrangler's --file mode returns only summary rows (no per-query result
# data), which makes grep-based row extraction unreliable. Use --command mode
# instead so verification queries return actual row data.
run_verify() {
  local migration_name="$1"
  local verify_sql="$2"
  local output
  output=$(npx wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    --remote \
    --command "$verify_sql" 2>/dev/null || true)

  # Pass if output has a non-empty results array with at least one row object.
  if echo "$output" | grep -q '"results":\s*\[' && ! echo "$output" | grep -qE '"results":\s*\[\s*\]'; then
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

# ─── Pre-execution guard: column-existence check for ADD COLUMN ──────────────
# For migrations using ALTER TABLE <t> ADD [COLUMN] <c>, verify the column does NOT
# already exist in pragma_table_info before executing. If it exists, skip with
# warning. This makes re-runs idempotent-safe without editing individual migration
# files (SQLite has no ADD COLUMN IF NOT EXISTS).
#
# NOTE: macOS ships ugrep as `grep -P`, which rejects variable-length lookbehind
# assertions. Parse with sed instead so the guard runs on the supported toolchain.
guard_add_column() {
  local migration_file="$1"
  local tmp_guard_sql
  tmp_guard_sql=$(mktemp -t migration-guard-add)

  local add_col_lines=()
  while IFS= read -r line; do
    # Match: ALTER TABLE <t> ADD [COLUMN] <c>
    if echo "$line" | grep -qiE 'ALTER[[:space:]]+TABLE[[:space:]]+[^;[:space:]]+[[:space:]]+ADD([[:space:]]+COLUMN)?[[:space:]]+[^;[:space:]]+'; then
      add_col_lines+=("$line")
    fi
  done < "$migration_file"

  if [ "${#add_col_lines[@]}" -eq 0 ]; then
    rm -f "$tmp_guard_sql"
    return 0
  fi

  local checks=()
  local guard_tbl=""
  for line in "${add_col_lines[@]}"; do
    local tbl col
    tbl=$(echo "$line" | sed -nE 's/^[[:space:]]*ALTER[[:space:]]+TABLE[[:space:]]+([^;[:space:]]+).*/\1/p' | tr -d ';' | tr -d ' ' || true)
    col=$(echo "$line" | sed -nE 's/^[[:space:]]*ALTER[[:space:]]+TABLE[[:space:]]+[^;[:space:]]+[[:space:]]+ADD([[:space:]]+COLUMN)?[[:space:]]+([^;[:space:]]+).*/\2/p' | tr -d ';' | tr -d ' ' || true)
    if [ -n "$tbl" ] && [ -n "$col" ]; then
      if [ -z "$guard_tbl" ]; then
        guard_tbl="$tbl"
      fi
      # pragma_table_info has no table_name column; filter on name only.
      checks+=("(name='${col}')")
    fi
  done

  if [ "${#checks[@]}" -eq 0 ]; then
    rm -f "$tmp_guard_sql"
    return 0
  fi

  local combined_where
  combined_where=$(IFS=' OR '; echo "${checks[*]}")

  cat > "$tmp_guard_sql" <<EOSQL
SELECT COUNT(*) AS cnt FROM pragma_table_info('${guard_tbl}')
WHERE ${combined_where};
EOSQL

  local count
  count=$(npx wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    --remote \
    --command "$(cat "$tmp_guard_sql")" 2>/dev/null \
    | grep -oE '"cnt"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+$' || echo "0")
  rm -f "$tmp_guard_sql"

  if [ "${count:-0}" -gt 0 ]; then
    echo "WARNING: Pre-flight guard: column(s) already exist in pragma_table_info."
    echo "   Columns checked: ${checks[*]}"
    echo "   Columns found:   ${count}"
    echo "   -> Skipping migration (safe: column likely already added by prior run)."
    return 1
  fi
  return 0
}

# ─── Pre-execution guard: table-existence check for DROP/RENAME ──────────────
# For migrations using DROP TABLE or ALTER TABLE RENAME, verify referenced tables
# exist in sqlite_master before executing. If missing, skip with warning.
# This makes re-runs idempotent-safe without editing individual migration files.
#
# NOTE: macOS ships ugrep as `grep -P`, which rejects variable-length lookbehind
# assertions. Parse with sed instead so the guard runs on the supported toolchain.
guard_drop_rename() {
  local migration_file="$1"
  local tmp_guard_sql
  tmp_guard_sql=$(mktemp -t migration-guard)

  local tables_to_check=()
  while IFS= read -r line; do
    local tbl=""
    # Match: DROP TABLE <name>;  (with or without IF EXISTS)
    tbl=$(echo "$line" | sed -nE 's/^[[:space:]]*DROP[[:space:]]+TABLE[[:space:]]+IF[[:space:]]+EXISTS[[:space:]]+([^;[:space:]]+).*/\1/p' | tr -d ';' | tr -d ' ' || true)
    if [ -z "$tbl" ]; then
      tbl=$(echo "$line" | sed -nE 's/^[[:space:]]*DROP[[:space:]]+TABLE[[:space:]]+([^;[:space:]]+).*/\1/p' | tr -d ';' | tr -d ' ' || true)
    fi
    if [ -n "$tbl" ]; then
      tables_to_check+=("$tbl")
    fi
    # Match: ALTER TABLE <old> RENAME TO <new>;
    tbl=$(echo "$line" | sed -nE 's/^[[:space:]]*ALTER[[:space:]]+TABLE[[:space:]]+([^;[:space:]]+).*/\1/p' | tr -d ';' | tr -d ' ' || true)
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
    --command "$(cat "$tmp_guard_sql")" 2>/dev/null \
    | grep -oE '"cnt"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+$' || echo "0")
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
  echo "Move these SQL files into migrations/ or document why they are not production D1 migrations:
    echo "NOTE: baseline duplicates may remain under migrations/_archive/""
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
  APPLIED_COUNT_DB=$(npx wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    --remote \
    --command "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name = '${MIGRATION_NAME}'" \
    2>/dev/null | grep -oE '"cnt"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+$' || echo "0")
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

  # Pre-flight guard for ADD COLUMN pattern migrations (idempotency)
  if ! guard_add_column "$m"; then
    echo "SKIPPED: ${MIGRATION_NAME} — column guard (column already exists)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  echo "==> Applying ${MIGRATION_NAME} to ${DB_NAME}"
  if ! npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --file="$m" "${WRANGLER_SCOPE_ARGS[@]}"; then
    echo "ERROR: ${MIGRATION_NAME} FAILED — continuing with remaining migrations"
    continue
  fi

  APPLIED_COUNT=$((APPLIED_COUNT + 1))

  # Post-flight schema verification
  for entry in "${VERIFY_AFTER[@]}"; do
    v_name="${entry%%|*}"
    v_sql="${entry#*|}"
    if [ "$v_name" = "$MIGRATION_NAME" ]; then
      echo "   Verifying schema after ${MIGRATION_NAME}..."
      if run_verify "$MIGRATION_NAME" "$v_sql"; then
        echo "   OK: Schema verification passed for ${MIGRATION_NAME}"
      else
        echo "   WARNING: Schema verification for ${MIGRATION_NAME}: expected objects not found."
        echo "      SQL: ${v_sql}"
        echo "      -> Continuing (non-blocking)."
      fi
    fi
  done
done

echo ""
echo "All done. Applied: ${APPLIED_COUNT} | Skipped: ${SKIPPED_COUNT}"
