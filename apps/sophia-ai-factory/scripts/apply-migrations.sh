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
WRANGLER_CMD="${WRANGLER_CMD:-npx wrangler}"

WRANGLER_SCOPE_ARGS=()
if [ -n "$WRANGLER_REMOTE_FLAG" ]; then
  WRANGLER_SCOPE_ARGS+=("$WRANGLER_REMOTE_FLAG")
fi
WRANGLER_SCOPE_ARGS+=("--yes")

run_wrangler() {
  $WRANGLER_CMD "$@"
}

# ─── Robust D1 JSON Query Helper ─────────────────────────────────────────────
# Never swallows errors or defaults to 0. Fails closed on any error, timeout,
# invalid JSON, or missing result property.
d1_query_json() {
  local sql="$1"
  local raw_output
  if ! raw_output=$(run_wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    "${WRANGLER_SCOPE_ARGS[@]}" \
    --json \
    --command "$sql" 2>&1); then
    echo "ERROR: D1 query execution failed for SQL: $sql" >&2
    echo "Output: $raw_output" >&2
    return 1
  fi

  local parsed
  if ! parsed=$(node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const startIdx = input.search(/[\[\{]/);
        if (startIdx === -1) {
          throw new Error("No JSON object or array found in D1 output: " + input);
        }
        const jsonStr = input.slice(startIdx);
        const data = JSON.parse(jsonStr);
        if (Array.isArray(data) && data[0] && data[0].results !== undefined) {
          process.stdout.write(JSON.stringify(data[0].results));
        } else if (data && data.results !== undefined) {
          process.stdout.write(JSON.stringify(data.results));
        } else {
          throw new Error("D1 JSON output missing results property: " + input);
        }
      } catch (err) {
        process.stderr.write(err.message + "\n");
        process.exit(2);
      }
    });
  ' <<< "$raw_output" 2>&1); then
    echo "ERROR: Failed to parse D1 JSON output for SQL: $sql" >&2
    echo "Raw output: $raw_output" >&2
    echo "Parser error: $parsed" >&2
    return 1
  fi

  echo "$parsed"
  return 0
}

d1_query_scalar() {
  local sql="$1"
  local field_name="$2"
  local results_json
  if ! results_json=$(d1_query_json "$sql"); then
    return 1
  fi

  local scalar_val
  if ! scalar_val=$(node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const rows = JSON.parse(input);
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error("Query returned empty result set");
        }
        const val = rows[0][process.argv[1]];
        if (val === undefined || val === null) {
          throw new Error("Field " + process.argv[1] + " not found or null in first row");
        }
        process.stdout.write(String(val));
      } catch (err) {
        process.stderr.write(err.message + "\n");
        process.exit(2);
      }
    });
  ' "$field_name" <<< "$results_json" 2>&1); then
    echo "ERROR: Failed to extract scalar field '\''$field_name'\'' from D1 output." >&2
    echo "JSON results: $results_json" >&2
    echo "Parser error: $scalar_val" >&2
    return 1
  fi

  echo "$scalar_val"
  return 0
}

is_migration_recorded_in_ledger() {
  local mig_name="$1"
  local table_exists
  if ! table_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='d1_migrations'" "cnt"); then
    echo "ERROR: Failed to check existence of d1_migrations table in sqlite_master" >&2
    return 2
  fi

  if [ "$table_exists" -eq 0 ]; then
    echo "ERROR: d1_migrations ledger table does not exist in sqlite_master. Cannot query migration ledger state." >&2
    return 2
  fi

  local count
  if ! count=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name = '${mig_name}' OR name = '${mig_name}.sql'" "cnt"); then
    echo "ERROR: Failed to query d1_migrations ledger for ${mig_name}" >&2
    return 2
  fi

  if [ "$count" -gt 0 ]; then
    return 0
  else
    return 1
  fi
}

# ─── Verify exact physical definition of 0473 partial unique index ───────────
verify_index_0473_definition() {
  local valid_def
  local sql="SELECT CASE
    WHEN (SELECT COUNT(*) FROM sqlite_master WHERE name = 'idx_sop_installs_user_listing_active') = 1
     AND (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_sop_installs_user_listing_active' AND tbl_name = 'sop_installs') = 1
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_installs') WHERE name = 'idx_sop_installs_user_listing_active' AND \"unique\" = 1 AND origin = 'c' AND partial = 1) = 1
     AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_sop_installs_user_listing_active') WHERE key = 1) = 2
     AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_sop_installs_user_listing_active') WHERE key = 1 AND ((seqno = 0 AND name = 'user_id' AND \"desc\" = 0) OR (seqno = 1 AND name = 'listing_id' AND \"desc\" = 0))) = 2
     AND (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_sop_installs_user_listing_active' AND (
       substr(replace(replace(replace(lower(sql), ' ', ''), char(10), ''), char(9), ''), -length('onsop_installs(user_id,listing_id)wherestatus=''active''')) = 'onsop_installs(user_id,listing_id)wherestatus=''active'''
       OR substr(replace(replace(replace(lower(sql), ' ', ''), char(10), ''), char(9), ''), -length('on\"sop_installs\"(user_id,listing_id)wherestatus=''active''')) = 'on\"sop_installs\"(user_id,listing_id)wherestatus=''active'''
     )) = 1
    THEN 1 ELSE 0 END AS cnt;"
  if ! valid_def=$(d1_query_scalar "$sql" "cnt"); then
    echo "FATAL ERROR: Failed to inspect physical definition of idx_sop_installs_user_listing_active" >&2
    return 2
  fi
  if [ "$valid_def" -ne 1 ]; then
    return 1
  fi
  return 0
}
# ─── Upfront Preflight Checks (Ghost Ledger Drift & Migration Prerequisites) ───
preflight_ghost_ledger() {
  echo "   [Preflight] Checking for ghost ledger drift in d1_migrations..."
  local table_exists
  if ! table_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='d1_migrations'" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to query sqlite_master for d1_migrations table" >&2
    exit 1
  fi

  if [ "$table_exists" -eq 0 ]; then
    echo "FATAL PREFLIGHT ERROR: d1_migrations ledger table does not exist in sqlite_master. Aborting before any DDL or write statements are executed." >&2
    exit 1
  fi

  # Check migration 0214
  local count_0214
  if ! count_0214=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name LIKE '0214%'" "cnt"); then
    echo "ERROR: Preflight failed to query ledger for migration 0214" >&2
    exit 1
  fi
  if [ "$count_0214" -gt 0 ]; then
    local tbl_installs_exists
    if ! tbl_installs_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='sop_installs'" "cnt"); then
      echo "ERROR: Preflight failed to check physical table sop_installs" >&2
      exit 1
    fi
    if [ "$tbl_installs_exists" -eq 0 ]; then
      echo "FATAL PREFLIGHT ERROR: Schema drift detected!" >&2
      echo "d1_migrations ledger records 0214_create_sop_installs as applied, but physical table 'sop_installs' is missing from sqlite_master." >&2
      echo "Aborting before any DDL statements are executed. Operator manual intervention required." >&2
      exit 1
    fi
    local col_installs_count
    if ! col_installs_count=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM pragma_table_info('sop_installs') WHERE name IN ('id', 'user_id', 'listing_id', 'status')" "cnt"); then
      echo "ERROR: Preflight failed to inspect columns of sop_installs" >&2
      exit 1
    fi
    if [ "$col_installs_count" -lt 4 ]; then
      echo "FATAL PREFLIGHT ERROR: Schema drift detected!" >&2
      echo "Table 'sop_installs' is missing one or more required columns ('id', 'user_id', 'listing_id', 'status'). Found: $col_installs_count of 4." >&2
      echo "Aborting before any DDL statements are executed." >&2
      exit 1
    fi
  fi

  # Check migration 0215
  local count_0215
  if ! count_0215=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name LIKE '0215%'" "cnt"); then
    echo "ERROR: Preflight failed to query ledger for migration 0215" >&2
    exit 1
  fi
  if [ "$count_0215" -gt 0 ]; then
    local tbl_reviews_exists
    if ! tbl_reviews_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='sop_reviews'" "cnt"); then
      echo "ERROR: Preflight failed to check physical table sop_reviews" >&2
      exit 1
    fi
    if [ "$tbl_reviews_exists" -eq 0 ]; then
      echo "FATAL PREFLIGHT ERROR: Schema drift detected!" >&2
      echo "d1_migrations ledger records 0215_create_sop_reviews as applied, but physical table 'sop_reviews' is missing from sqlite_master." >&2
      echo "Aborting before any DDL statements are executed." >&2
      exit 1
    fi
    local col_reviews_count
    if ! col_reviews_count=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM pragma_table_info('sop_reviews') WHERE name IN ('id', 'install_id', 'user_id', 'rating')" "cnt"); then
      echo "ERROR: Preflight failed to inspect columns of sop_reviews" >&2
      exit 1
    fi
    if [ "$col_reviews_count" -lt 4 ]; then
      echo "FATAL PREFLIGHT ERROR: Schema drift detected!" >&2
      echo "Table 'sop_reviews' is missing one or more required columns ('id', 'install_id', 'user_id', 'rating'). Found: $col_reviews_count of 4." >&2
      echo "Aborting before any DDL statements are executed." >&2
      exit 1
    fi
  fi

  # Check migration 0216
  local count_0216
  if ! count_0216=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name LIKE '0216%'" "cnt"); then
    echo "ERROR: Preflight failed to query ledger for migration 0216" >&2
    exit 1
  fi
  if [ "$count_0216" -gt 0 ]; then
    local tables_0216=("creator_profiles" "sop_listings" "sop_installs" "sop_reviews")
    for tbl_0216 in "${tables_0216[@]}"; do
      local tbl_exists
      if ! tbl_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='${tbl_0216}'" "cnt"); then
        echo "ERROR: Preflight failed to check physical table ${tbl_0216}" >&2
        exit 1
      fi
      if [ "$tbl_exists" -eq 0 ]; then
        echo "FATAL PREFLIGHT ERROR: Schema drift detected!" >&2
        echo "d1_migrations ledger records 0216_add_tenant_id_to_marketplace_tables as applied, but physical table '${tbl_0216}' is missing from sqlite_master." >&2
        echo "Aborting before any DDL statements are executed." >&2
        exit 1
      fi

      local tenant_col
      if ! tenant_col=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM pragma_table_info('${tbl_0216}') WHERE name = 'tenant_id'" "cnt"); then
        echo "ERROR: Preflight failed to verify tenant_id in ${tbl_0216}" >&2
        exit 1
      fi
      if [ "$tenant_col" -eq 0 ]; then
        echo "FATAL PREFLIGHT ERROR: Schema drift detected!" >&2
        echo "d1_migrations ledger records 0216_add_tenant_id_to_marketplace_tables as applied, but column 'tenant_id' is missing from '${tbl_0216}'." >&2
        echo "Aborting before any DDL statements are executed." >&2
        exit 1
      fi
    done
  fi

  # Check migration 0473 (unique partial index on sop_installs)
  local count_0473
  if ! count_0473=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name LIKE '0473%'" "cnt"); then
    echo "ERROR: Preflight failed to query ledger for migration 0473" >&2
    exit 1
  fi
  if [ "$count_0473" -gt 0 ]; then
    local idx_0473_exists
    if ! idx_0473_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='index' AND name='idx_sop_installs_user_listing_active'" "cnt"); then
      echo "ERROR: Preflight failed to check physical index idx_sop_installs_user_listing_active" >&2
      exit 1
    fi
    if [ "$idx_0473_exists" -eq 0 ]; then
      echo "FATAL PREFLIGHT ERROR: Schema drift detected!" >&2
      echo "d1_migrations ledger records 0473_sop_installs_active_unique_index as applied, but physical index 'idx_sop_installs_user_listing_active' is missing from sqlite_master." >&2
      echo "Aborting before any DDL statements are executed." >&2
      exit 1
    fi
    if ! verify_index_0473_definition; then
      echo "FATAL PREFLIGHT ERROR: Schema drift detected!" >&2
      echo "Physical index 'idx_sop_installs_user_listing_active' exists but does not match required UNIQUE partial index definition on sop_installs(user_id, listing_id) WHERE status = 'active'." >&2
      echo "Aborting before any DDL statements are executed." >&2
      exit 1
    fi
  fi

  echo "   [Preflight] Ghost ledger check OK."
  return 0
}

preflight_migration_0473() {
  echo "   [Preflight] Checking prerequisites for migration 0473 (sop_installs unique index)..."

  # 1. Physical table sop_installs must exist
  local tbl_exists
  if ! tbl_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='sop_installs'" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to check existence of table 'sop_installs' for migration 0473" >&2
    exit 1
  fi
  if [ "$tbl_exists" -eq 0 ]; then
    echo "FATAL PREFLIGHT ERROR: Migration 0473 requires physical table 'sop_installs', but table does not exist in sqlite_master!" >&2
    echo "Aborting before any DDL statements are executed." >&2
    exit 1
  fi

  # 2. Required columns: user_id, listing_id, status must exist
  local cols_count
  if ! cols_count=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM pragma_table_info('sop_installs') WHERE name IN ('user_id', 'listing_id', 'status')" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to inspect columns of 'sop_installs' for migration 0473" >&2
    exit 1
  fi
  if [ "$cols_count" -lt 3 ]; then
    echo "FATAL PREFLIGHT ERROR: Migration 0473 requires columns ('user_id', 'listing_id', 'status') in 'sop_installs', but only $cols_count of 3 found!" >&2
    echo "Aborting before any DDL statements are executed." >&2
    exit 1
  fi

  # 3. Duplicate active installs must be exactly 0
  local dup_groups
  local dup_query="SELECT COUNT(*) AS duplicate_groups FROM (SELECT user_id, listing_id FROM sop_installs WHERE status = 'active' GROUP BY user_id, listing_id HAVING COUNT(*) > 1) AS duplicate_pairs;"
  if ! dup_groups=$(d1_query_scalar "$dup_query" "duplicate_groups"); then
    echo "FATAL PREFLIGHT ERROR: Failed to execute duplicate active install preflight query for migration 0473" >&2
    exit 1
  fi
  if [ "$dup_groups" -ne 0 ]; then
    echo "FATAL PREFLIGHT ERROR: Found $dup_groups duplicate active install groups in 'sop_installs'!" >&2
    echo "Creating partial unique index idx_sop_installs_user_listing_active would fail or violate integrity." >&2
    echo "Aborting before any DDL statements are executed. Duplicate active rows must be resolved prior to applying migration 0473." >&2
    exit 1
  fi

  # 4. If an object or index named idx_sop_installs_user_listing_active already exists,
  #    verify its exact definition so CREATE UNIQUE INDEX IF NOT EXISTS cannot silently skip a bad index.
  local pre_idx_obj
  if ! pre_idx_obj=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE lower(name) = 'idx_sop_' || 'installs_user_listing_active'" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to check for pre-existing idx_sop_installs_user_listing_active object" >&2
    exit 1
  fi
  if [ "$pre_idx_obj" -gt 0 ]; then
    if ! verify_index_0473_definition; then
      echo "FATAL PREFLIGHT ERROR: Pre-existing object/index 'idx_sop_installs_user_listing_active' has an invalid definition (must be UNIQUE partial index on sop_installs(user_id, listing_id) WHERE status = 'active')!" >&2
      echo "Refusing to allow CREATE UNIQUE INDEX IF NOT EXISTS to silently skip a drifted index. Aborting before any writes." >&2
      exit 1
    fi
  fi

  echo "   [Preflight] Migration 0473 prerequisites verified: table, columns exist, 0 duplicate active rows."
  return 0
}

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

# ── Critical SOP migrations: blocking verification ──
add_verify "0214_create_sop_installs" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='sop_installs'"
add_verify "0215_create_sop_reviews" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='sop_reviews'"
add_verify "0216_add_tenant_id_to_marketplace_tables" \
  "SELECT name FROM pragma_table_info('sop_installs') WHERE name = 'tenant_id'"
add_verify "0473_sop_installs_active_unique_index" \
  "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sop_installs_user_listing_active'"
add_verify "0474_reconcile_sop_marketplace_schema" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='sop_installs'"

is_critical_migration() {
  local name="$1"
  case "$name" in
    0214*|0215*|0216*|0473*|0474*|0116*|0126*|0059*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# ─── Scoped Recovery Path for Migration 0474 (Marketplace Schema Reconciliation) ─
preflight_reconcile_0474() {
  echo "   [Preflight 0474] Verifying allowlisted drift and prerequisites for 0474_reconcile_sop_marketplace_schema..."

  # 1. Verify no temporary rebuild object (table/view/index/trigger) from an interrupted run exists
  local tmp_tbl_exists
  if ! tmp_tbl_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE name='sop_listings_new' OR tbl_name='sop_listings_new'" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to check sqlite_master for temporary object sop_listings_new" >&2
    exit 1
  fi
  if [ "$tmp_tbl_exists" -gt 0 ]; then
    echo "FATAL PREFLIGHT ERROR: Partial rebuild state detected: temporary table 'sop_listings_new' exists in sqlite_master. Aborting without cleanup." >&2
    exit 1
  fi

  # 2. Verify ledger records 0126 and 0212..0216 as applied, and 0473 is NOT recorded while un-reconciled
  local required_ledger=("0126" "0212" "0213" "0214" "0215" "0216")
  for req_prefix in "${required_ledger[@]}"; do
    local l_cnt
    if ! l_cnt=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name LIKE '${req_prefix}%'" "cnt"); then
      echo "FATAL PREFLIGHT ERROR: Failed to query d1_migrations ledger for ${req_prefix}%" >&2
      exit 1
    fi
    if [ "$l_cnt" -eq 0 ]; then
      echo "FATAL PREFLIGHT ERROR: Ledger state does not match allowlisted 0474 reconciliation drift (missing ${req_prefix}% in d1_migrations). Aborting before any writes." >&2
      exit 1
    fi
  done

  local count_0473
  if ! count_0473=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name LIKE '0473%'" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to query d1_migrations ledger for 0473%" >&2
    exit 1
  fi
  if [ "$count_0473" -gt 0 ]; then
    echo "FATAL PREFLIGHT ERROR: Ledger state does not match allowlisted 0474 reconciliation drift (0473 already recorded before 0474 reconciliation). Aborting before any writes." >&2
    exit 1
  fi

  # 3. Verify physical prerequisite tables exist: user, creator_profiles (with tenant_id), sop_licenses, sop_listings
  local prereq_tables=("user" "creator_profiles" "sop_licenses" "sop_listings")
  for p_tbl in "${prereq_tables[@]}"; do
    local p_exists
    if ! p_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='${p_tbl}'" "cnt"); then
      echo "FATAL PREFLIGHT ERROR: Failed to check physical prerequisite table ${p_tbl}" >&2
      exit 1
    fi
    if [ "$p_exists" -eq 0 ]; then
      echo "FATAL PREFLIGHT ERROR: Missing prerequisite table '${p_tbl}' required for 0474 reconciliation. Aborting before any writes." >&2
      exit 1
    fi
  done

  local cp_tenant
  if ! cp_tenant=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM pragma_table_info('creator_profiles') WHERE name = 'tenant_id'" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to inspect creator_profiles.tenant_id" >&2
    exit 1
  fi
  if [ "$cp_tenant" -eq 0 ]; then
    echo "FATAL PREFLIGHT ERROR: Prerequisite column 'creator_profiles.tenant_id' is missing. Aborting before any writes." >&2
    exit 1
  fi

  # 4. Reject any object-name collision (table, view, index, trigger) for sop_installs, sop_reviews,
  #    or any target index names owned by 0474/0473.
  local obj_collision
  if ! obj_collision=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE name IN ('sop_installs','sop_reviews','idx_sop_listings_creator_id','idx_sop_listings_status','idx_sop_listings_category','idx_sop_listings_rating','idx_sop_listings_tenant_id','idx_sop_installs_listing_id','idx_sop_installs_user_id','idx_sop_installs_license_id','idx_sop_installs_status','idx_sop_installs_user_status','idx_sop_installs_tenant_id','idx_sop_installs_user_listing_active','idx_sop_reviews_install_id','idx_sop_reviews_user_id','idx_sop_reviews_rating','idx_sop_reviews_tenant_id') OR tbl_name IN ('sop_installs','sop_reviews')" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to check sqlite_master for object-name collisions" >&2
    exit 1
  fi
  if [ "$obj_collision" -gt 0 ]; then
    echo "FATAL PREFLIGHT ERROR: Partial or unexpected schema state / object-name collision in sqlite_master for sop_installs, sop_reviews, or target indexes (${obj_collision} object(s) found) while 0474 is unapplied. Aborting without cleanup." >&2
    exit 1
  fi

  # Also verify creator_profiles target index names (idx_creator_profiles_user_id, idx_creator_profiles_status, idx_creator_profiles_tenant_id):
  # each name must either be absent from sqlite_master OR be a non-unique, non-partial index on creator_profiles with the exact single key column (ASC).
  local cp_idx_ok
  local cp_idx_sql="SELECT CASE
    WHEN (
      (SELECT COUNT(*) FROM sqlite_master WHERE name = 'idx_creator_profiles_user_id') = 0
      OR (
        (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_creator_profiles_user_id' AND tbl_name = 'creator_profiles') = 1
        AND (SELECT COUNT(*) FROM pragma_index_list('creator_profiles') WHERE name = 'idx_creator_profiles_user_id' AND \"unique\" = 0 AND origin = 'c' AND partial = 0) = 1
        AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_creator_profiles_user_id') WHERE key = 1) = 1
        AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_creator_profiles_user_id') WHERE key = 1 AND seqno = 0 AND name = 'user_id' AND \"desc\" = 0) = 1
      )
    )
    AND (
      (SELECT COUNT(*) FROM sqlite_master WHERE name = 'idx_creator_profiles_status') = 0
      OR (
        (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_creator_profiles_status' AND tbl_name = 'creator_profiles') = 1
        AND (SELECT COUNT(*) FROM pragma_index_list('creator_profiles') WHERE name = 'idx_creator_profiles_status' AND \"unique\" = 0 AND origin = 'c' AND partial = 0) = 1
        AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_creator_profiles_status') WHERE key = 1) = 1
        AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_creator_profiles_status') WHERE key = 1 AND seqno = 0 AND name = 'status' AND \"desc\" = 0) = 1
      )
    )
    AND (
      (SELECT COUNT(*) FROM sqlite_master WHERE name = 'idx_creator_profiles_tenant_id') = 0
      OR (
        (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_creator_profiles_tenant_id' AND tbl_name = 'creator_profiles') = 1
        AND (SELECT COUNT(*) FROM pragma_index_list('creator_profiles') WHERE name = 'idx_creator_profiles_tenant_id' AND \"unique\" = 0 AND origin = 'c' AND partial = 0) = 1
        AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_creator_profiles_tenant_id') WHERE key = 1) = 1
        AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_creator_profiles_tenant_id') WHERE key = 1 AND seqno = 0 AND name = 'tenant_id' AND \"desc\" = 0) = 1
      )
    )
    THEN 1 ELSE 0 END AS cnt;"
  if ! cp_idx_ok=$(d1_query_scalar "$cp_idx_sql" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to inspect creator_profiles index definitions" >&2
    exit 1
  fi
  if [ "$cp_idx_ok" -ne 1 ]; then
    echo "FATAL PREFLIGHT ERROR: Object-name collision or invalid index definition on creator_profiles index names (idx_creator_profiles_user_id, idx_creator_profiles_status, idx_creator_profiles_tenant_id). Aborting before any writes." >&2
    exit 1
  fi

  # 5. Verify sop_listings is strictly in V1 (0126) baseline state:
  #    - total column count == 16 (no extra/unknown/V2 columns that could be dropped by rebuild)
  #    - all 16 columns match exact migration 0126 cid, name, type, notnull, default, pk
  #    - status CHECK constraint matches V1 0126
  local total_cols v1_exact_cols
  if ! total_cols=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM pragma_table_info('sop_listings')" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to count columns of sop_listings" >&2
    exit 1
  fi
  if [ "$total_cols" -ne 16 ]; then
    echo "FATAL PREFLIGHT ERROR: Partial or unexpected schema state on sop_listings: expected exactly 16 V1 columns, found ${total_cols} total columns. Aborting before any writes." >&2
    exit 1
  fi

  local v1_shape_sql="SELECT COUNT(*) AS cnt FROM pragma_table_info('sop_listings') WHERE
       (cid = 0 AND name = 'id' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 1)
    OR (cid = 1 AND name = 'template_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
    OR (cid = 2 AND name = 'price_cents' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
    OR (cid = 3 AND name = 'currency' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value = '''USD''' AND pk = 0)
    OR (cid = 4 AND name = 'preview_md' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
    OR (cid = 5 AND name = 'demo_video_url' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
    OR (cid = 6 AND name = 'tags' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
    OR (cid = 7 AND name = 'total_sales' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
    OR (cid = 8 AND name = 'total_revenue_cents' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
    OR (cid = 9 AND name = 'rating_avg' AND upper(type) = 'REAL' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
    OR (cid = 10 AND name = 'rating_count' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
    OR (cid = 11 AND name = 'status' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value = '''pending_review''' AND pk = 0)
    OR (cid = 12 AND name = 'rejection_reason' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
    OR (cid = 13 AND name = 'published_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
    OR (cid = 14 AND name = 'created_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
    OR (cid = 15 AND name = 'updated_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0);"
  if ! v1_exact_cols=$(d1_query_scalar "$v1_shape_sql" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to inspect V1 column metadata of sop_listings" >&2
    exit 1
  fi
  if [ "$v1_exact_cols" -ne 16 ]; then
    echo "FATAL PREFLIGHT ERROR: sop_listings column metadata does not match migration 0126 baseline (matched ${v1_exact_cols}/16 columns). Aborting before any writes." >&2
    exit 1
  fi

  # 6. Verify V1 index baseline on sop_listings: only allowlisted V1 indexes exist and match exact structure
  local v1_idx_ok
  local v1_idx_sql="SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_index_list('sop_listings') WHERE origin = 'c') = 2
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_listings') WHERE origin = 'c' AND name NOT IN ('idx_listing_status', 'idx_listing_template')) = 0
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_listings') WHERE name = 'idx_listing_status' AND \"unique\" = 0 AND origin = 'c' AND partial = 0) = 1
     AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_listing_status') WHERE key = 1) = 2
     AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_listing_status') WHERE key = 1 AND ((seqno = 0 AND name = 'status' AND \"desc\" = 0 AND cid = 11) OR (seqno = 1 AND name = 'published_at' AND \"desc\" = 1 AND cid = 13))) = 2
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_listings') WHERE name = 'idx_listing_template' AND \"unique\" = 0 AND origin = 'c' AND partial = 0) = 1
     AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_listing_template') WHERE key = 1) = 1
     AND (SELECT COUNT(*) FROM pragma_index_xinfo('idx_listing_template') WHERE key = 1 AND seqno = 0 AND name = 'template_id' AND \"desc\" = 0 AND cid = 1) = 1
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_listings') il JOIN pragma_index_xinfo(il.name) ix ON ix.key = 1 WHERE il.origin = 'u' AND il.\"unique\" = 1 AND il.partial = 0 AND ix.seqno = 0 AND ix.name = 'template_id') = 1
    THEN 1 ELSE 0 END AS cnt;"
  if ! v1_idx_ok=$(d1_query_scalar "$v1_idx_sql" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to inspect V1 indexes of sop_listings" >&2
    exit 1
  fi
  if [ "$v1_idx_ok" -ne 1 ]; then
    echo "FATAL PREFLIGHT ERROR: sop_listings indexes do not match expected V1 allowlist/definitions (idx_listing_status, idx_listing_template, UNIQUE template_id). Aborting before any writes." >&2
    exit 1
  fi

  # 7. Verify no unexpected triggers, views, or inbound foreign keys (including quoted table names) reference sop_listings.
  #    Cloudflare D1 sqlite_master includes internal _cf_* tables whose PRAGMA inspection raises SQLITE_AUTH [code: 7500].
  #    Discover candidate user tables from sqlite_master first, then inspect each candidate via literal pragma_foreign_key_list('<table>').
  local fk_dep_count=0
  local candidate_fk_json
  if ! candidate_fk_json=$(d1_query_json "SELECT name FROM sqlite_master WHERE type = 'table' AND name != 'sop_listings' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' AND lower(sql) LIKE '%sop_listings%'"); then
    echo "FATAL PREFLIGHT ERROR: Failed to query sqlite_master for candidate tables referencing sop_listings" >&2
    exit 1
  fi
  local candidate_tables
  if ! candidate_tables=$(node -e '
    let input = "";
    process.stdin.on("data", c => input += c);
    process.stdin.on("end", () => {
      const rows = JSON.parse(input);
      for (const r of rows) {
        if (r && typeof r.name === "string" && /^[A-Za-z0-9_]+$/.test(r.name)) {
          process.stdout.write(r.name + "\n");
        } else if (r && r.name) {
          process.exit(3);
        }
      }
    });
  ' <<< "$candidate_fk_json"); then
    echo "FATAL PREFLIGHT ERROR: Unsafe or unparseable table name referencing sop_listings" >&2
    exit 1
  fi
  while IFS= read -r cand_tbl; do
    [ -z "$cand_tbl" ] && continue
    local cand_fk_cnt
    if ! cand_fk_cnt=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM pragma_foreign_key_list('${cand_tbl}') WHERE lower(\"table\") = 'sop_listings'" "cnt"); then
      echo "FATAL PREFLIGHT ERROR: Failed to check pragma_foreign_key_list for table ${cand_tbl}" >&2
      exit 1
    fi
    fk_dep_count=$((fk_dep_count + cand_fk_cnt))
  done <<< "$candidate_tables"

  local trig_view_dep_count
  if ! trig_view_dep_count=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type IN ('trigger', 'view') AND name NOT LIKE '_cf_%' AND (lower(tbl_name) = 'sop_listings' OR lower(sql) LIKE '%sop_listings%')" "cnt"); then
    echo "FATAL PREFLIGHT ERROR: Failed to check sqlite_master for triggers/views referencing sop_listings" >&2
    exit 1
  fi
  if [ "$fk_dep_count" -gt 0 ] || [ "$trig_view_dep_count" -gt 0 ]; then
    echo "FATAL PREFLIGHT ERROR: Found unexpected trigger(s)/view(s) (${trig_view_dep_count}) or inbound foreign key(s) (${fk_dep_count}) referencing sop_listings. Aborting before any writes." >&2
    exit 1
  fi

  echo "   [Preflight 0474] Allowlisted drift and prerequisites verified."
  return 0
}

postflight_verify_0474() {
  local expected_row_count="$1"
  echo "   [Postflight 0474] Verifying reconciled schema and data integrity..."

  # 1. Temporary table/objects must be gone
  local tmp_cnt
  if ! tmp_cnt=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE name='sop_listings_new' OR tbl_name='sop_listings_new'" "cnt"); then
    echo "FATAL ERROR: Postflight 0474 failed to check for temporary table sop_listings_new" >&2
    return 1
  fi
  if [ "$tmp_cnt" -ne 0 ]; then
    echo "FATAL ERROR: Postflight 0474 failed: temporary table sop_listings_new still exists!" >&2
    return 1
  fi

  # 2. All 3 target tables must exist
  local tbl_cnt
  if ! tbl_cnt=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name IN ('sop_listings','sop_installs','sop_reviews')" "cnt"); then
    echo "FATAL ERROR: Postflight 0474 failed to verify target tables in sqlite_master" >&2
    return 1
  fi
  if [ "$tbl_cnt" -ne 3 ]; then
    echo "FATAL ERROR: Postflight 0474 failed: expected 3 tables (sop_listings, sop_installs, sop_reviews), found ${tbl_cnt}!" >&2
    return 1
  fi

  # 3. Verify exact column counts AND column metadata on sop_listings (25), sop_installs (10), sop_reviews (7)
  local col_shape_ok
  local col_shape_sql="SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('sop_listings')) = 25
     AND (SELECT COUNT(*) FROM pragma_table_info('sop_listings') WHERE
          (cid = 0 AND name = 'id' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 1)
       OR (cid = 1 AND name = 'template_id' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 2 AND name = 'creator_id' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 3 AND name = 'title' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 4 AND name = 'description' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 5 AND name = 'price_cents' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 6 AND name = 'currency' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value = '''USD''' AND pk = 0)
       OR (cid = 7 AND name = 'preview_md' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 8 AND name = 'category' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 9 AND name = 'tags' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 10 AND name = 'thumbnail_url' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 11 AND name = 'demo_video_url' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 12 AND name = 'sop_template_id' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 13 AND name = 'total_sales' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
       OR (cid = 14 AND name = 'total_revenue_cents' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
       OR (cid = 15 AND name = 'rating_avg' AND upper(type) = 'REAL' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
       OR (cid = 16 AND name = 'rating_count' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
       OR (cid = 17 AND name = 'install_count' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
       OR (cid = 18 AND name = 'rating' AND upper(type) = 'REAL' AND \"notnull\" = 0 AND dflt_value = '0' AND pk = 0)
       OR (cid = 19 AND name = 'status' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value = '''pending_review''' AND pk = 0)
       OR (cid = 20 AND name = 'rejection_reason' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 21 AND name = 'published_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 22 AND name = 'created_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 23 AND name = 'updated_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 24 AND name = 'tenant_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value = '''default''' AND pk = 0)
     ) = 25
     AND (SELECT COUNT(*) FROM pragma_table_info('sop_installs')) = 10
     AND (SELECT COUNT(*) FROM pragma_table_info('sop_installs') WHERE
          (cid = 0 AND name = 'id' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 1)
       OR (cid = 1 AND name = 'listing_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 2 AND name = 'user_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 3 AND name = 'license_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 4 AND name = 'price_cents' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 5 AND name = 'commission_id' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 6 AND name = 'status' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value = '''active''' AND pk = 0)
       OR (cid = 7 AND name = 'installed_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 8 AND name = 'uninstalled_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 9 AND name = 'tenant_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value = '''default''' AND pk = 0)
     ) = 10
     AND (SELECT COUNT(*) FROM pragma_table_info('sop_reviews')) = 7
     AND (SELECT COUNT(*) FROM pragma_table_info('sop_reviews') WHERE
          (cid = 0 AND name = 'id' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 1)
       OR (cid = 1 AND name = 'install_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 2 AND name = 'user_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 3 AND name = 'rating' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 4 AND name = 'review_text' AND upper(type) = 'TEXT' AND \"notnull\" = 0 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 5 AND name = 'created_at' AND upper(type) = 'INTEGER' AND \"notnull\" = 1 AND dflt_value IS NULL AND pk = 0)
       OR (cid = 6 AND name = 'tenant_id' AND upper(type) = 'TEXT' AND \"notnull\" = 1 AND dflt_value = '''default''' AND pk = 0)
     ) = 7
    THEN 1 ELSE 0 END AS cnt;"
  if ! col_shape_ok=$(d1_query_scalar "$col_shape_sql" "cnt"); then
    echo "FATAL ERROR: Postflight 0474 failed to verify column metadata of target tables" >&2
    return 1
  fi
  if [ "$col_shape_ok" -ne 1 ]; then
    echo "FATAL ERROR: Postflight 0474 failed: column shape/metadata mismatch on sop_listings, sop_installs, or sop_reviews!" >&2
    return 1
  fi

  # 4. Verify foreign keys, unique constraints, CHECK constraints, and exact definitions of all 20 named indexes (with zero extra indexes)
  local constraints_and_indexes_ok
  local ci_sql="SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_foreign_key_list('sop_listings')) = 1
     AND (SELECT COUNT(*) FROM pragma_foreign_key_list('sop_listings') WHERE lower(\"table\") = 'creator_profiles' AND \"from\" = 'creator_id' AND \"to\" = 'id') = 1
     AND (SELECT COUNT(*) FROM pragma_foreign_key_list('sop_installs')) = 2
     AND (SELECT COUNT(*) FROM pragma_foreign_key_list('sop_installs') WHERE (lower(\"table\") = 'sop_listings' AND \"from\" = 'listing_id' AND \"to\" = 'id') OR (lower(\"table\") = 'user' AND \"from\" = 'user_id' AND \"to\" = 'id')) = 2
     AND (SELECT COUNT(*) FROM pragma_foreign_key_list('sop_reviews')) = 2
     AND (SELECT COUNT(*) FROM pragma_foreign_key_list('sop_reviews') WHERE (lower(\"table\") = 'sop_installs' AND \"from\" = 'install_id' AND \"to\" = 'id') OR (lower(\"table\") = 'user' AND \"from\" = 'user_id' AND \"to\" = 'id')) = 2
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_listings') il JOIN pragma_index_xinfo(il.name) ix ON ix.key = 1 WHERE il.origin = 'u' AND il.\"unique\" = 1 AND il.partial = 0 AND ix.seqno = 0 AND ix.name = 'template_id') = 1
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_installs') il JOIN pragma_index_xinfo(il.name) ix ON ix.key = 1 WHERE il.origin = 'u' AND il.\"unique\" = 1 AND il.partial = 0 AND ix.seqno = 0 AND ix.name = 'license_id') = 1
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_reviews') il JOIN pragma_index_xinfo(il.name) ix ON ix.key = 1 WHERE il.origin = 'u' AND il.\"unique\" = 1 AND il.partial = 0 AND ix.seqno = 0 AND ix.name = 'install_id') = 1
     AND (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sop_listings' AND instr(replace(replace(replace(lower(sql), ' ', ''), char(10), ''), char(9), ''), 'check(statusin(''pending_review'',''published'',''rejected'',''suspended'',''draft'',''archived''))') > 0 AND instr(replace(replace(replace(lower(sql), ' ', ''), char(10), ''), char(9), ''), 'check((template_idisnotnull)or(creator_idisnotnullandtitleisnotnullandsop_template_idisnotnull))') > 0) = 1
     AND (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sop_installs' AND instr(replace(replace(replace(lower(sql), ' ', ''), char(10), ''), char(9), ''), 'check(statusin(''active'',''uninstalled''))') > 0) = 1
     AND (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sop_reviews' AND instr(replace(replace(replace(lower(sql), ' ', ''), char(10), ''), char(9), ''), 'check(rating>=1andrating<=5)') > 0) = 1
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_listings') WHERE origin = 'c') = 7
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_installs') WHERE origin = 'c' AND name != 'idx_sop_installs_user_listing_active') = 6
     AND (SELECT COUNT(*) FROM pragma_index_list('sop_reviews') WHERE origin = 'c') = 4
     AND (
       (SELECT COUNT(*) FROM pragma_index_list('sop_listings') il WHERE il.origin = 'c' AND il.\"unique\" = 0 AND il.partial = 0 AND (
            (il.name = 'idx_listing_status' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 2 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND ((seqno = 0 AND name = 'status' AND \"desc\" = 0) OR (seqno = 1 AND name = 'published_at' AND \"desc\" = 1))) = 2)
         OR (il.name = 'idx_listing_template' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'template_id' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_listings_creator_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'creator_id' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_listings_status' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'status' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_listings_category' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'category' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_listings_rating' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'rating' AND \"desc\" = 1) = 1)
         OR (il.name = 'idx_sop_listings_tenant_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'tenant_id' AND \"desc\" = 0) = 1)
       )) +
       (SELECT COUNT(*) FROM pragma_index_list('sop_installs') il WHERE il.origin = 'c' AND il.\"unique\" = 0 AND il.partial = 0 AND (
            (il.name = 'idx_sop_installs_listing_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'listing_id' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_installs_user_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'user_id' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_installs_license_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'license_id' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_installs_status' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'status' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_installs_user_status' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 2 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND ((seqno = 0 AND name = 'user_id' AND \"desc\" = 0) OR (seqno = 1 AND name = 'status' AND \"desc\" = 0))) = 2)
         OR (il.name = 'idx_sop_installs_tenant_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'tenant_id' AND \"desc\" = 0) = 1)
       )) +
       (SELECT COUNT(*) FROM pragma_index_list('sop_reviews') il WHERE il.origin = 'c' AND il.\"unique\" = 0 AND il.partial = 0 AND (
            (il.name = 'idx_sop_reviews_install_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'install_id' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_reviews_user_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'user_id' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_reviews_rating' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'rating' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_sop_reviews_tenant_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'tenant_id' AND \"desc\" = 0) = 1)
       )) +
       (SELECT COUNT(*) FROM pragma_index_list('creator_profiles') il WHERE il.origin = 'c' AND il.\"unique\" = 0 AND il.partial = 0 AND (
            (il.name = 'idx_creator_profiles_user_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'user_id' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_creator_profiles_status' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'status' AND \"desc\" = 0) = 1)
         OR (il.name = 'idx_creator_profiles_tenant_id' AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1) = 1 AND (SELECT COUNT(*) FROM pragma_index_xinfo(il.name) WHERE key = 1 AND seqno = 0 AND name = 'tenant_id' AND \"desc\" = 0) = 1)
       ))
     ) = 20
    THEN 1 ELSE 0 END AS cnt;"
  if ! constraints_and_indexes_ok=$(d1_query_scalar "$ci_sql" "cnt"); then
    echo "FATAL ERROR: Postflight 0474 failed to verify constraints and indexes" >&2
    return 1
  fi
  if [ "$constraints_and_indexes_ok" -ne 1 ]; then
    echo "FATAL ERROR: Postflight 0474 failed: foreign key, unique/check constraint, or index definition mismatch!" >&2
    return 1
  fi

  # 5. Verify row count parity on sop_listings before and after rebuild
  local post_row_count
  if ! post_row_count=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sop_listings" "cnt"); then
    echo "FATAL ERROR: Postflight 0474 failed to count rows in sop_listings" >&2
    return 1
  fi
  if [ "$post_row_count" -ne "$expected_row_count" ]; then
    echo "FATAL ERROR: Postflight 0474 row count mismatch on sop_listings (before=${expected_row_count}, after=${post_row_count})!" >&2
    return 1
  fi

  echo "   [Postflight 0474] Schema and row count parity verified."
  return 0
}

# ─── Helper: run a verification query against D1 ─────────────────────────────
run_verify() {
  local migration_name="$1"
  local verify_sql="$2"
  local results_json
  if ! results_json=$(d1_query_json "$verify_sql"); then
    return 1
  fi

  local row_count
  row_count=$(node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const rows = JSON.parse(input);
        process.stdout.write(String(Array.isArray(rows) ? rows.length : 0));
      } catch (e) {
        process.exit(2);
      }
    });
  ' <<< "$results_json" 2>/dev/null || echo "0")

  if [ "${row_count:-0}" -gt 0 ]; then
    return 0
  else
    return 1
  fi
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

  local add_col_lines=()
  while IFS= read -r line; do
    # Match: ALTER TABLE <t> ADD [COLUMN] <c>
    if echo "$line" | grep -qiE 'ALTER[[:space:]]+TABLE[[:space:]]+[^;[:space:]]+[[:space:]]+ADD([[:space:]]+COLUMN)?[[:space:]]+[^;[:space:]]+'; then
      add_col_lines+=("$line")
    fi
  done < "$migration_file"

  if [ "${#add_col_lines[@]}" -eq 0 ]; then
    return 0
  fi

  local guard_tables=()
  local guard_cols=()
  for line in "${add_col_lines[@]}"; do
    local tbl col
    tbl=$(echo "$line" | sed -nE 's/^[[:space:]]*ALTER[[:space:]]+TABLE[[:space:]]+([^;[:space:]]+).*/\1/p' | tr -d ';' | tr -d ' ' || true)
    col=$(echo "$line" | sed -nE 's/^[[:space:]]*ALTER[[:space:]]+TABLE[[:space:]]+[^;[:space:]]+[[:space:]]+ADD([[:space:]]+COLUMN)?[[:space:]]+([^;[:space:]]+).*/\2/p' | tr -d ';' | tr -d ' ' || true)
    if [ -n "$tbl" ] && [ -n "$col" ]; then
      guard_tables+=("$tbl")
      guard_cols+=("$col")
    fi
  done

  if [ "${#guard_cols[@]}" -eq 0 ]; then
    return 0
  fi

  # Each table is checked against its own pragma_table_info. Collecting the
  # columns but binding them to a single table would make a column that belongs
  # to table B look "already present" because table A happens to have that name,
  # and the migration would then be skipped with its real columns missing.
  local existing_count=0 total_checks=0 i
  local -a found_cols=()
  for ((i = 0; i < ${#guard_tables[@]}; i++)); do
    total_checks=$((total_checks + 1))
    local one_sql="SELECT COUNT(*) AS cnt FROM pragma_table_info('${guard_tables[$i]}') WHERE name='${guard_cols[$i]}';"
    local one_count
    if ! one_count=$(d1_query_scalar "$one_sql" "cnt"); then
      echo "ERROR: Guard failed to inspect columns in pragma_table_info for ${guard_tables[$i]}" >&2
      exit 1
    fi
    one_count=${one_count:-0}
    if [ "$one_count" -gt 0 ]; then
      existing_count=$((existing_count + 1))
      found_cols+=("${guard_tables[$i]}.${guard_cols[$i]}")
    fi
  done

  if [ "${existing_count:-0}" -gt 0 ]; then
    echo "WARNING: Pre-flight guard: column(s) already exist in pragma_table_info."
    echo "   Columns checked: ${total_checks}"
    echo "   Already present: ${found_cols[*]}"
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
    tbl=$(echo "$line" | sed -nE 's/^[[:space:]]*ALTER[[:space:]]+TABLE[[:space:]]+([^;[:space:]]+)[[:space:]]+RENAME[[:space:]]+TO.*/\1/p' | tr -d ';' | tr -d ' ' || true)
    if [ -n "$tbl" ]; then
      tables_to_check+=("$tbl")
    fi
  done < "$migration_file"

  if [ "${#tables_to_check[@]}" -eq 0 ]; then
    return 0
  fi

  local where_clauses=()
  for tbl in "${tables_to_check[@]}"; do
    where_clauses+=("(name = '${tbl}' AND type = 'table')")
  done
  local combined_where="" i
  # IFS holds one character only, so join the clauses explicitly.
  for ((i = 0; i < ${#where_clauses[@]}; i++)); do
    [ "$i" -gt 0 ] && combined_where+=" OR "
    combined_where+="${where_clauses[$i]}"
  done

  local guard_sql="SELECT COUNT(*) AS cnt FROM sqlite_master WHERE ${combined_where};"
  local count
  if ! count=$(d1_query_scalar "$guard_sql" "cnt"); then
    echo "ERROR: Guard failed to check tables in sqlite_master for ${migration_file}" >&2
    exit 1
  fi

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
# Security Guard: MIGRATIONS_OVERRIDE is deprecated and strictly forbidden
if [ -n "${MIGRATIONS_OVERRIDE:-}" ]; then
  echo "FATAL SECURITY ERROR: MIGRATIONS_OVERRIDE is deprecated and strictly forbidden in production pipeline!" >&2
  exit 1
fi

# --relative emits paths relative to CWD (apps/sophia-ai-factory/) so the
# [ -f "$m" ] check + wrangler --file=$m resolve correctly.
MIGRATIONS=$(git diff --name-only --diff-filter=d --relative "$REF" HEAD -- migrations/ 2>/dev/null | grep -E "\.sql$" | grep -v "/_archive/" | sort || true)
NON_CANONICAL_D1_SQL=$(git diff --name-only --diff-filter=d --relative "$REF" HEAD -- src/seed/db/migrations/ 2>/dev/null | grep -E "\.sql$" | sort || true)
if [ -n "$NON_CANONICAL_D1_SQL" ]; then
  echo "ERROR: Refusing to apply non-canonical D1 migration files."
  echo "Move these SQL files into migrations/ or document why they are not production D1 migrations."
  echo "NOTE: baseline duplicates may remain under migrations/_archive/"
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

# ─── Upfront Preflight Gates (Executed BEFORE first DDL statement) ───────────
echo "==> Running upfront preflight checks..."

DELTA_HAS_0474=0
MIGRATION_0474_FILE=""
declare -a REMAINING_MIGRATIONS=()
for m_check in $MIGRATIONS; do
  m_base=$(basename "$m_check" .sql)
  if [ "$m_base" = "0474_reconcile_sop_marketplace_schema" ]; then
    DELTA_HAS_0474=1
    MIGRATION_0474_FILE="$m_check"
  else
    REMAINING_MIGRATIONS+=("$m_check")
  fi
done

APPLIED_COUNT=0
SKIPPED_COUNT=0

if [ "$DELTA_HAS_0474" -eq 1 ]; then
  if [ ! -f "$MIGRATION_0474_FILE" ]; then
    echo "FATAL PREFLIGHT ERROR: Migration file not found: $MIGRATION_0474_FILE" >&2
    exit 1
  fi

  MIGRATION_0474_NAME="0474_reconcile_sop_marketplace_schema"
  ledger_status_0474=0
  is_migration_recorded_in_ledger "$MIGRATION_0474_NAME" || ledger_status_0474=$?

  if [ "$ledger_status_0474" -eq 2 ]; then
    echo "FATAL PREFLIGHT ERROR: Failed to query d1_migrations ledger for ${MIGRATION_0474_NAME}! Halting pipeline before any writes." >&2
    exit 1
  fi

  if [ "$ledger_status_0474" -eq 0 ]; then
    echo "   [Preflight 0474] ${MIGRATION_0474_NAME} is already recorded in ledger; verifying reconciled state..."
    existing_row_count=""
    if ! existing_row_count=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sop_listings" "cnt"); then
      echo "FATAL PREFLIGHT ERROR: Failed to query sop_listings row count for already-recorded ${MIGRATION_0474_NAME}" >&2
      exit 1
    fi
    if ! postflight_verify_0474 "$existing_row_count"; then
      echo "FATAL SCHEMA DRIFT: ${MIGRATION_0474_NAME} is recorded in d1_migrations ledger, but reconciled schema verification failed!" >&2
      exit 1
    fi
    echo "SKIPPED: ${MIGRATION_0474_NAME} already applied"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
  else
    preflight_reconcile_0474

    pre_0474_row_count=""
    if ! pre_0474_row_count=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sop_listings" "cnt"); then
      echo "FATAL PREFLIGHT ERROR: Failed to capture sop_listings row count prior to ${MIGRATION_0474_NAME}" >&2
      exit 1
    fi

    echo "==> Applying ${MIGRATION_0474_NAME} to ${DB_NAME} (prior to remaining delta)"
    if ! run_wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --file="$MIGRATION_0474_FILE" "${WRANGLER_SCOPE_ARGS[@]}"; then
      echo "ERROR: ${MIGRATION_0474_NAME} FAILED — aborting migration run without cleanup" >&2
      exit 1
    fi

    echo "   Verifying schema after ${MIGRATION_0474_NAME}..."
    if ! postflight_verify_0474 "$pre_0474_row_count"; then
      echo "FATAL ERROR: Critical schema verification failed for ${MIGRATION_0474_NAME}!" >&2
      echo "   Refusing to record in d1_migrations ledger to prevent ghost-ledger drift. Aborting pipeline!" >&2
      exit 1
    fi
    echo "   OK: Schema verification passed for ${MIGRATION_0474_NAME}"

    echo "   Recording ${MIGRATION_0474_NAME} into d1_migrations ledger..."
    ledger_insert_0474="INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('${MIGRATION_0474_NAME}', CURRENT_TIMESTAMP), ('${MIGRATION_0474_NAME}.sql', CURRENT_TIMESTAMP);"
    if ! run_wrangler d1 execute "$DB_NAME" \
      --config "$WRANGLER_CONFIG" \
      "${WRANGLER_SCOPE_ARGS[@]}" \
      --command "$ledger_insert_0474"; then
      echo "FATAL ERROR: Failed to record ${MIGRATION_0474_NAME} in d1_migrations ledger!" >&2
      exit 1
    fi

    APPLIED_COUNT=$((APPLIED_COUNT + 1))
  fi

  echo "==> Re-running full ghost-ledger preflight after ${MIGRATION_0474_NAME}..."
  preflight_ghost_ledger
else
  preflight_ghost_ledger
fi

# If remaining migration delta contains migration 0473 (sop_installs unique index),
# verify all prerequisites (table exists, columns exist, 0 duplicate active pairs).
DELTA_HAS_0473=0
for m_check in "${REMAINING_MIGRATIONS[@]+"${REMAINING_MIGRATIONS[@]}"}"; do
  [ -z "$m_check" ] && continue
  m_base=$(basename "$m_check" .sql)
  if [[ "$m_base" == *"0473"* ]]; then
    DELTA_HAS_0473=1
    break
  fi
done

if [ "$DELTA_HAS_0473" -eq 1 ]; then
  preflight_migration_0473
fi
echo "==> Upfront preflight checks passed."

for m in "${REMAINING_MIGRATIONS[@]+"${REMAINING_MIGRATIONS[@]}"}"; do
  [ -z "$m" ] && continue
  if [ ! -f "$m" ]; then
    echo "WARNING: File not found (may have been deleted): $m — skipping"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  MIGRATION_NAME=$(basename "$m" .sql)

  # Guard: check if migration already recorded in D1 d1_migrations table (3 explicit states)
  # 0 = recorded (already applied)
  # 1 = not recorded (pending execution)
  # 2 = query execution failed (must halt pipeline immediately)
  ledger_status=0
  is_migration_recorded_in_ledger "$MIGRATION_NAME" || ledger_status=$?

  if [ "$ledger_status" -eq 2 ]; then
    echo "FATAL ERROR: Failed to query d1_migrations ledger for ${MIGRATION_NAME}! Halting pipeline to prevent unsafe execution." >&2
    exit 1
  fi

  if [ "$ledger_status" -eq 0 ]; then
    # Special drift guard for 0473: if recorded as applied, verify physical index exists and has exact definition!
    if [[ "$MIGRATION_NAME" == *"0473"* ]]; then
      idx_0473_exists=""
      if ! idx_0473_exists=$(d1_query_scalar "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='index' AND name='idx_sop_installs_user_listing_active'" "cnt"); then
        echo "FATAL ERROR: Failed to check physical index idx_sop_installs_user_listing_active for 0473!" >&2
        exit 1
      fi
      if [ "$idx_0473_exists" -eq 0 ]; then
        echo "FATAL SCHEMA DRIFT: Migration 0473 is recorded as applied in d1_migrations ledger, but physical index 'idx_sop_installs_user_listing_active' is missing from sqlite_master!" >&2
        echo "Refusing to skip silently. Halting pipeline!" >&2
        exit 1
      fi
      if ! verify_index_0473_definition; then
        echo "FATAL SCHEMA DRIFT: Migration 0473 is recorded as applied in d1_migrations ledger, but physical index 'idx_sop_installs_user_listing_active' has an invalid definition!" >&2
        echo "Refusing to skip silently. Halting pipeline!" >&2
        exit 1
      fi
    fi

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
  if ! run_wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --file="$m" "${WRANGLER_SCOPE_ARGS[@]}"; then
    echo "ERROR: ${MIGRATION_NAME} FAILED — aborting migration run" >&2
    exit 1
  fi

  # Post-flight schema verification runs BEFORE recording in ledger
  if [[ "$MIGRATION_NAME" == *"0473"* ]]; then
    echo "   Verifying exact index definition after ${MIGRATION_NAME}..."
    if ! verify_index_0473_definition; then
      echo "FATAL ERROR: Critical schema verification failed for ${MIGRATION_NAME} (invalid definition of idx_sop_installs_user_listing_active)!" >&2
      echo "   Refusing to record in d1_migrations ledger to prevent ghost-ledger drift. Aborting pipeline!" >&2
      exit 1
    fi
  fi
  for entry in "${VERIFY_AFTER[@]}"; do
    v_name="${entry%%|*}"
    v_sql="${entry#*|}"
    if [ "$v_name" = "$MIGRATION_NAME" ]; then
      echo "   Verifying schema after ${MIGRATION_NAME}..."
      if run_verify "$MIGRATION_NAME" "$v_sql"; then
        echo "   OK: Schema verification passed for ${MIGRATION_NAME}"
      else
        if is_critical_migration "$MIGRATION_NAME"; then
          echo "FATAL ERROR: Critical schema verification failed for ${MIGRATION_NAME}!" >&2
          echo "   Expected schema objects not found with SQL: ${v_sql}" >&2
          echo "   Refusing to record in d1_migrations ledger to prevent ghost-ledger drift. Aborting pipeline!" >&2
          exit 1
        else
          echo "   WARNING: Schema verification for ${MIGRATION_NAME}: expected objects not found."
          echo "      SQL: ${v_sql}"
          echo "      -> Continuing (non-blocking for non-critical migration)."
        fi
      fi
    fi
  done

  # Record applied migration into d1_migrations ledger ONLY after verification succeeds
  echo "   Recording ${MIGRATION_NAME} into d1_migrations ledger..."
  ledger_insert_cmd="INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('${MIGRATION_NAME}', CURRENT_TIMESTAMP), ('${MIGRATION_NAME}.sql', CURRENT_TIMESTAMP);"
  if ! run_wrangler d1 execute "$DB_NAME" \
    --config "$WRANGLER_CONFIG" \
    "${WRANGLER_SCOPE_ARGS[@]}" \
    --command "$ledger_insert_cmd"; then
    echo "FATAL ERROR: Failed to record ${MIGRATION_NAME} in d1_migrations ledger!" >&2
    exit 1
  fi

  APPLIED_COUNT=$((APPLIED_COUNT + 1))
done

echo ""
echo "All done. Applied: ${APPLIED_COUNT} | Skipped: ${SKIPPED_COUNT}"
