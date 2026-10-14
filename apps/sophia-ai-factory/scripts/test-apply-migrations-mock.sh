#!/usr/bin/env bash
# ─── test-apply-migrations-mock.sh ───────────────────────────────────────────
# Unit & integration mock harness for apply-migrations.sh
# Tests preflight gates, fail-closed mechanics, 3-state ledger handling,
# and verifies that ZERO write operations (both --file and mutating --command)
# are dispatched on any failure branch.
# Runs 100% locally with NO Cloudflare/D1 network access.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_SCRIPT="$APP_DIR/scripts/apply-migrations.sh"

TESTS_RUN=0
TESTS_PASSED=0

run_test() {
  local test_name="$1"
  local mock_mode="$2"
  local expected_exit="$3"
  local expected_pattern="$4"
  local env_override="${5:-}"
  local extra_env="${6:-}"
  local fixture_mode="${7:-with_migration}"
  local expect_mock_calls="${8:-yes}"

  TESTS_RUN=$((TESTS_RUN + 1))
  echo -n "Test $TESTS_RUN: $test_name ... "

  local tmp_root
  tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/test-wrangler-mock.XXXXXX")
  local tmp_bin="$tmp_root/bin"
  local fixture_repo="$tmp_root/repo"
  mkdir -p "$tmp_bin" "$fixture_repo/scripts"

  # Build an isolated Git fixture so the production script discovers a real
  # migration delta from Git instead of accepting a test-only override.
  git -C "$fixture_repo" init -q
  git -C "$fixture_repo" config user.name "D1 Mock Harness"
  git -C "$fixture_repo" config user.email "d1-mock-harness@example.invalid"
  git -C "$fixture_repo" config core.hooksPath "$tmp_root/no-hooks"
  cp "$TARGET_SCRIPT" "$fixture_repo/scripts/apply-migrations.sh"
  printf '%s\n' "D1 migration test fixture" > "$fixture_repo/README.md"
  git -C "$fixture_repo" add scripts/apply-migrations.sh README.md
  git -C "$fixture_repo" -c commit.gpgsign=false commit -q -m "fixture baseline"

  printf '%s\n' "fixture delta" > "$fixture_repo/fixture-delta.txt"
  if [ "$fixture_mode" = "with_migration" ]; then
    mkdir -p "$fixture_repo/migrations"
    cp "$APP_DIR/migrations/0473_sop_installs_active_unique_index.sql" "$fixture_repo/migrations/"
    git -C "$fixture_repo" add migrations/0473_sop_installs_active_unique_index.sql
  fi
  git -C "$fixture_repo" add fixture-delta.txt
  git -C "$fixture_repo" -c commit.gpgsign=false commit -q -m "fixture head"

  # Create mock wrangler binary
  cat <<'EOF' > "$tmp_bin/wrangler"
#!/usr/bin/env bash
# Mock wrangler D1 execute
CMD=""
IS_JSON=0
IS_FILE=0
FILE_PATH=""

# Record full argv for audit verification
echo "WRANGLER_ARGV: $*" >> "${TEST_ARGV_LOG:-/dev/null}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --command)
      CMD="$2"
      shift 2
      ;;
    --command=*)
      CMD="${1#*=}"
      shift
      ;;
    --file)
      IS_FILE=1
      FILE_PATH="$2"
      shift 2
      ;;
    --file=*)
      IS_FILE=1
      FILE_PATH="${1#*=}"
      shift
      ;;
    --json)
      IS_JSON=1
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Audit any --file DDL execution attempt
if [ "$IS_FILE" -eq 1 ]; then
  echo "WRITE_FILE: $FILE_PATH" >> "$TEST_WRITE_LOG"
  echo "WRITE_FILE: $FILE_PATH" >> "$TEST_EVENT_LOG"
  echo '[{"results":[],"success":true,"meta":{"changes":1}}]'
  exit 0
fi

# Audit any mutating SQL statements sent via --command
if [ -n "$CMD" ]; then
  first_word=$(echo "$CMD" | awk '{print toupper($1)}')
  case "$first_word" in
    INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE)
      echo "WRITE_COMMAND: $CMD" >> "$TEST_WRITE_LOG"
      echo "WRITE_COMMAND: $CMD" >> "$TEST_EVENT_LOG"
      echo '[{"results":[],"success":true,"meta":{"changes":1}}]'
      exit 0
      ;;
  esac
fi

if [[ "$CMD" == *"idx_sop_installs_user_listing_active"* ]]; then
  echo "VERIFY_INDEX: $CMD" >> "$TEST_EVENT_LOG"
fi

MODE="${MOCK_MODE:-clean}"

case "$MODE" in
  clean)
    echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    ;;

  missing_d1_migrations)
    # d1_migrations table does not exist in sqlite_master
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  ghost_ledger_0214)
    # d1_migrations exists, has 0214, but sqlite_master sop_installs returns 0
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "d1_migrations" && "$CMD" =~ "0214%" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_installs" ]]; then
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  ghost_ledger_missing_col)
    # d1_migrations has 0214, sop_installs table exists, but missing required columns (only 2 of 4)
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "d1_migrations" && "$CMD" =~ "0214%" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_installs" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_installs')" ]]; then
      echo '[{"results":[{"cnt":2}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  ghost_ledger_0216_missing_table)
    # 0216 recorded in ledger, but physical table sop_reviews is missing
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "d1_migrations" && "$CMD" =~ "0216%" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "creator_profiles" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('creator_profiles')" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_listings" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_listings')" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_installs" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_installs')" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_reviews" ]]; then
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  ghost_ledger_0216_missing_col)
    # 0216 recorded in ledger, all 4 tables exist, but sop_listings missing tenant_id column
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "d1_migrations" && "$CMD" =~ "0216%" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && ( "$CMD" =~ "creator_profiles" || "$CMD" =~ "sop_listings" || "$CMD" =~ "sop_installs" || "$CMD" =~ "sop_reviews" ) ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('creator_profiles')" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_listings')" ]]; then
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_installs')" || "$CMD" =~ "pragma_table_info('sop_reviews')" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  ghost_ledger_0473_drift)
    # 0473 in ledger, but physical index idx_sop_installs_user_listing_active missing in sqlite_master
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "d1_migrations" && "$CMD" =~ "0473%" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "idx_sop_installs_user_listing_active" ]]; then
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  m0473_missing_table)
    # Ledger clean, but 0473 preflight checks sop_installs and it returns 0
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_installs" ]]; then
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  m0473_duplicates_found)
    # sop_installs table & columns exist, but duplicate active install groups = 3
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_installs" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_installs')" ]]; then
      echo '[{"results":[{"cnt":4}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "duplicate_groups" ]]; then
      echo '[{"results":[{"duplicate_groups":3}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  query_error)
    # Database query error / network error during upfront preflight
    echo "D1_ERROR: connection timeout to remote database" >&2
    exit 1
    ;;

  loop_ledger_query_error)
    # Upfront preflights pass, but ledger query inside the migration loop fails
    if [[ "$CMD" =~ "d1_migrations" && ( "$CMD" =~ "WHERE name = '0473_sop_installs_active_unique_index'" || "$CMD" =~ "0473_sop_installs_active_unique_index.sql" ) ]]; then
      echo "D1_ERROR: connection timeout while reading ledger in migration loop" >&2
      exit 1
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_installs" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_installs')" ]]; then
      echo '[{"results":[{"cnt":4}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "duplicate_groups" ]]; then
      echo '[{"results":[{"duplicate_groups":0}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  loop_0473_index_drift)
    # Upfront preflight passes, but during loop 0473 is marked applied and physical index is missing
    if [[ "$CMD" =~ "d1_migrations" && ( "$CMD" =~ "WHERE name = '0473_sop_installs_active_unique_index'" || "$CMD" =~ "0473_sop_installs_active_unique_index.sql" ) ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "idx_sop_installs_user_listing_active" ]]; then
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_installs" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_installs')" ]]; then
      echo '[{"results":[{"cnt":4}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "duplicate_groups" ]]; then
      echo '[{"results":[{"duplicate_groups":0}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  happy_path_0473)
    if [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "d1_migrations" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "sop_installs" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "pragma_table_info('sop_installs')" ]]; then
      echo '[{"results":[{"cnt":4}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "duplicate_groups" ]]; then
      echo '[{"results":[{"duplicate_groups":0}],"success":true,"meta":{}}]'
    elif [[ "$CMD" =~ "sqlite_master" && "$CMD" =~ "idx_sop_installs_user_listing_active" ]]; then
      echo '[{"results":[{"cnt":1}],"success":true,"meta":{}}]'
    else
      echo '[{"results":[{"cnt":0}],"success":true,"meta":{}}]'
    fi
    ;;

  *)
    echo '[{"results":[],"success":true,"meta":{}}]'
    ;;
esac
exit 0
EOF
  chmod +x "$tmp_bin/wrangler"

  # Poison npx completely. The production script must invoke WRANGLER_CMD,
  # which is pinned directly to the mock above; no npx fallback is acceptable.
  cat <<EOF > "$tmp_bin/npx"
#!/usr/bin/env bash
echo "UNEXPECTED_NPX_INVOCATION: \$*" >> "\${TEST_ARGV_LOG:-/dev/null}"
echo "ERROR: Unexpected npx invocation in mock harness: \$*" >&2
exit 99
EOF
  chmod +x "$tmp_bin/npx"

  local test_write_log="$tmp_bin/write_executed.log"
  touch "$test_write_log"

  local test_argv_log="$tmp_bin/argv.log"
  touch "$test_argv_log"

  local test_event_log="$tmp_bin/events.log"
  touch "$test_event_log"

  local test_output="$tmp_bin/output.log"
  local actual_exit=0

  # Run in subshell with mock in PATH
  (
    export PATH="$tmp_bin:$PATH"
    export MOCK_MODE="$mock_mode"
    export TEST_WRITE_LOG="$test_write_log"
    export TEST_ARGV_LOG="$test_argv_log"
    export TEST_EVENT_LOG="$test_event_log"
    unset CI GITHUB_ACTIONS NODE_ENV ENVIRONMENT CF_PAGES MIGRATIONS_OVERRIDE
    unset __D1_TEST_HARNESS_MIGRATIONS_DELTA __D1_MOCK_HARNESS_TOKEN WRANGLER_CMD WRANGLER_REMOTE_FLAG DB_NAME WRANGLER_CONFIG
    # Pin directly to the temporary mock. The --local flag is only passed to
    # this mock executable; no Wrangler binary is invoked by the harness.
    export WRANGLER_CMD="$tmp_bin/wrangler"
    export WRANGLER_REMOTE_FLAG="--local"
    export DB_NAME="sophia-raas-db-mock"
    export WRANGLER_CONFIG="wrangler.mock.toml"

    if [ -n "$env_override" ]; then
      export "$env_override"
    fi
    if [ -n "$extra_env" ]; then
      export "$extra_env"
    fi

    cd "$fixture_repo"
    bash scripts/apply-migrations.sh HEAD~1 > "$test_output" 2>&1
  ) || actual_exit=$?

  local write_count
  write_count=$(wc -l < "$test_write_log" | tr -d ' ')

  # Assert that --remote was NEVER passed in mock wrangler invocations
  if grep -q -- "--remote" "$test_argv_log"; then
    echo "FAILED! (--remote flag detected in mock wrangler invocations!)"
    cat "$test_argv_log"
    rm -rf "$tmp_root"
    exit 1
  fi

  # Assert that npx was never invoked, even as `npx wrangler`.
  if grep -q "UNEXPECTED_NPX_INVOCATION" "$test_argv_log"; then
    echo "FAILED! (Unexpected npx invocation detected!)"
    cat "$test_argv_log"
    rm -rf "$tmp_root"
    exit 1
  fi

  # Tests that exercise the pipeline must reach the direct mock binary. Tests
  # for ignored overrides or early guards must make no Wrangler invocation.
  local mock_call_count
  mock_call_count=$(grep -c '^WRANGLER_ARGV:' "$test_argv_log" || true)
  if [ "$expect_mock_calls" = "yes" ]; then
    if ! grep -q "WRANGLER_ARGV:" "$test_argv_log"; then
      echo "FAILED! (Mock binary was not invoked!)"
      cat "$test_output"
      rm -rf "$tmp_root"
      exit 1
    fi
  elif [ "$mock_call_count" -ne 0 ]; then
    echo "FAILED! (Expected no mock Wrangler calls, found $mock_call_count)"
    cat "$test_argv_log"
    rm -rf "$tmp_root"
    exit 1
  fi

  # Assert exit code
  if [ "$actual_exit" -ne "$expected_exit" ]; then
    echo "FAILED! (Expected exit $expected_exit, got $actual_exit)"
    cat "$test_output"
    rm -rf "$tmp_root"
    exit 1
  fi

  # Assert output message pattern
  if [ -n "$expected_pattern" ] && ! grep -qE "$expected_pattern" "$test_output"; then
    echo "FAILED! (Pattern '$expected_pattern' not found in output)"
    cat "$test_output"
    rm -rf "$tmp_root"
    exit 1
  fi

  # In all failure cases, ensure ZERO write execution (DDL file or mutating command) took place
  if [ "$expected_exit" -ne 0 ] && [ "$write_count" -gt 0 ]; then
    echo "FAILED! (Preflight/ledger failed but $write_count write operations were dispatched!)"
    cat "$test_write_log"
    rm -rf "$tmp_root"
    exit 1
  fi

  if [ "$mock_mode" = "happy_path_0473" ]; then
    local ddl_line verify_line ledger_line
    ddl_line=$(grep -n '^WRITE_FILE:' "$test_event_log" | head -n 1 | cut -d: -f1 || true)
    verify_line=$(grep -n '^VERIFY_INDEX:' "$test_event_log" | head -n 1 | cut -d: -f1 || true)
    ledger_line=$(grep -n '^WRITE_COMMAND: INSERT OR IGNORE INTO d1_migrations' "$test_event_log" | head -n 1 | cut -d: -f1 || true)
    if [ -z "$ddl_line" ] || [ -z "$verify_line" ] || [ -z "$ledger_line" ] || [ "$ddl_line" -ge "$verify_line" ] || [ "$verify_line" -ge "$ledger_line" ]; then
      echo "FAILED! (Expected order DDL -> index verification -> migration ledger INSERT)"
      cat "$test_event_log"
      rm -rf "$tmp_root"
      exit 1
    fi
    if [ "$write_count" -ne 2 ]; then
      echo "FAILED! (Expected exactly DDL and ledger writes, got $write_count)"
      cat "$test_write_log"
      rm -rf "$tmp_root"
      exit 1
    fi
  fi

  echo "PASSED (exit=$actual_exit, writes_dispatched=$write_count)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  rm -rf "$tmp_root"
}

echo "================================================================================"
echo "APPLY-MIGRATIONS FAIL-CLOSED PREFLIGHT HARNESS"
echo "================================================================================"

# Case 1: Ghost ledger detected (ledger has 0214, but sop_installs missing in sqlite_master)
run_test \
  "Ghost ledger drift (0214 in ledger, table missing)" \
  "ghost_ledger_0214" \
  1 \
  "d1_migrations ledger records 0214_create_sop_installs as applied, but physical table 'sop_installs' is missing"

# Case 2: Ghost ledger detected (sop_installs missing required columns)
run_test \
  "Ghost ledger column drift (0214 in ledger, columns missing)" \
  "ghost_ledger_missing_col" \
  1 \
  "Table 'sop_installs' is missing one or more required columns"

# Case 3: Ghost ledger 0216 table drift (0216 in ledger, sop_reviews missing)
run_test \
  "Ghost ledger 0216 table drift (0216 in ledger, sop_reviews missing)" \
  "ghost_ledger_0216_missing_table" \
  1 \
  "d1_migrations ledger records 0216_add_tenant_id_to_marketplace_tables as applied, but physical table 'sop_reviews' is missing"

# Case 4: Ghost ledger 0216 column drift (0216 in ledger, tenant_id missing on sop_listings)
run_test \
  "Ghost ledger 0216 column drift (0216 in ledger, tenant_id missing on sop_listings)" \
  "ghost_ledger_0216_missing_col" \
  1 \
  "d1_migrations ledger records 0216_add_tenant_id_to_marketplace_tables as applied, but column 'tenant_id' is missing from 'sop_listings'"

# Case 5: Ghost ledger 0473 drift (0473 in ledger, idx_sop_installs_user_listing_active missing)
run_test \
  "Ghost ledger 0473 index drift in upfront preflight" \
  "ghost_ledger_0473_drift" \
  1 \
  "d1_migrations ledger records 0473_sop_installs_active_unique_index as applied, but physical index 'idx_sop_installs_user_listing_active' is missing"

# Case 6: Missing d1_migrations ledger table halts before any DDL or write operations
run_test \
  "Missing d1_migrations ledger table halts before any DDL or write operations" \
  "missing_d1_migrations" \
  1 \
  "FATAL PREFLIGHT ERROR: d1_migrations ledger table does not exist in sqlite_master"

# Case 7: Migration 0473 preflight halts if sop_installs table missing
run_test \
  "Migration 0473 halts when sop_installs table is missing" \
  "m0473_missing_table" \
  1 \
  "Migration 0473 requires physical table 'sop_installs'"

# Case 8: Migration 0473 preflight halts when duplicate active pairs exist
run_test \
  "Migration 0473 halts when duplicate active pairs exist" \
  "m0473_duplicates_found" \
  1 \
  "Found 3 duplicate active install groups in 'sop_installs'"

# Case 9: D1 query/network error fails closed (no silent echo 0)
run_test \
  "D1 query failure during upfront preflight fails closed" \
  "query_error" \
  1 \
  "FATAL PREFLIGHT ERROR: Failed to query sqlite_master for d1_migrations table"

# Case 10: In-loop ledger query error (state 2) halts pipeline and prevents DDL/mutations
run_test \
  "Migration loop ledger query error halts pipeline with 0 writes" \
  "loop_ledger_query_error" \
  1 \
  "FATAL ERROR: Failed to query d1_migrations ledger for 0473_sop_installs_active_unique_index"

# Case 11: In-loop 0473 index drift check halts pipeline if index missing
run_test \
  "Migration loop detects missing 0473 index when recorded in ledger" \
  "loop_0473_index_drift" \
  1 \
  "FATAL SCHEMA DRIFT: Migration 0473 is recorded as applied in d1_migrations ledger, but physical index 'idx_sop_installs_user_listing_active' is missing"

# Case 12: Security Guard - MIGRATIONS_OVERRIDE is deprecated and strictly rejected
run_test \
  "Security guard rejects deprecated MIGRATIONS_OVERRIDE" \
  "clean" \
  1 \
  "FATAL SECURITY ERROR: MIGRATIONS_OVERRIDE is deprecated and strictly forbidden" \
  "MIGRATIONS_OVERRIDE=migrations/0473_sop_installs_active_unique_index.sql" \
  "" \
  "with_migration" \
  "no"

# Case 13: Legacy test delta environment variable cannot invent a Git migration delta
run_test \
  "Legacy test delta env var ignored when Git has no migration delta" \
  "clean" \
  0 \
  "No new migrations to apply" \
  "" \
  "__D1_TEST_HARNESS_MIGRATIONS_DELTA=migrations/0473_sop_installs_active_unique_index.sql" \
  "without_migration" \
  "no"

# Case 14: Happy path (clean preflight, verified objects, DDL & ledger write executed)
run_test \
  "Happy path with migration 0473 (preflight clean, DDL applied and verified)" \
  "happy_path_0473" \
  0 \
  "All done. Applied: 1"

# ─────────────────────────────────────────────────────────────────────────────
# SQLITE-BACKED RECONCILIATION HARNESS (0474 + 0473)
# Uses real local SQLite via node:sqlite inside the pinned mock wrangler binary.
# Zero real Wrangler/npx/Cloudflare/network invocations.
# ─────────────────────────────────────────────────────────────────────────────

init_drifted_sqlite_db() {
  local db_file="$1"
  local setup_variant="${2:-standard_drift}"
  node --no-warnings - "$db_file" "$setup_variant" "$APP_DIR" <<'NODE_INIT'
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const [dbFile, variant, appDir] = process.argv.slice(2);
const db = new DatabaseSync(dbFile);

if (variant === 'missing_d1_migrations') {
  db.exec(`CREATE TABLE dummy (id TEXT PRIMARY KEY);`);
  db.close();
  process.exit(0);
}

db.exec(`
  CREATE TABLE d1_migrations(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );

  CREATE TABLE "user" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL
  );

  CREATE TABLE creator_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    payout_method TEXT,
    payout_address TEXT,
    total_earnings_cents INTEGER DEFAULT 0,
    total_paid_cents INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    tenant_id TEXT NOT NULL DEFAULT 'default',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    payout_rail TEXT DEFAULT 'USDT' CHECK (payout_rail IN ('USDT', 'VIETQR')),
    bank_bin TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT
  );

  CREATE TABLE user_sop_installations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    customizations TEXT,
    schedule_cron TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at INTEGER,
    next_run_at INTEGER,
    run_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    config_values TEXT
  );
`);

// Apply 0126 (creates V1 sop_listings and sop_licenses + V1 indexes)
const sql0126 = fs.readFileSync(path.join(appDir, 'migrations/0126_sop_marketplace_tables.sql'), 'utf8');
db.exec(sql0126);

// Seed production-matching ledger rows (including id=677 truncated-name row)
db.exec(`
  INSERT INTO d1_migrations (id, name) VALUES
    (400, '0126_sop_marketplace_tables.sql'),
    (450, '0212_create_creator_profiles.sql'),
    (451, '0213_create_sop_listings.sql'),
    (452, '0214_create_sop_installs.sql'),
    (454, '0216_add_tenant_id_to_marketplace_tables.sql'),
    (636, '0215_create_sop_reviews.sql'),
    (643, '0275_autonomous_growth_and_revenue.sql'),
    (666, '0291_creator_templates_and_withdrawals.sql'),
    (673, '0298_creator_reviews_marketplace.sql'),
    (677, '0298_creator_reviews_marketplace');
`);

// Seed users, creator profile, V1 sop_listings, V1 sop_licenses, and Playbook installation
db.exec(`
  INSERT INTO "user" (id, email) VALUES ('usr_1', 'u1@example.com'), ('usr_2', 'u2@example.com');
  INSERT INTO creator_profiles (id, user_id, display_name, total_earnings_cents, total_paid_cents, status, tenant_id)
  VALUES ('cp_1', 'usr_1', 'Creator One', 15000, 5000, 'active', 'default');

  INSERT INTO sop_listings (
    id, template_id, price_cents, currency, preview_md, demo_video_url, tags,
    total_sales, total_revenue_cents, rating_avg, rating_count, status,
    rejection_reason, published_at, created_at, updated_at
  ) VALUES (
    'v1_list_1', 'v1_tmpl_1', 2500, 'USD', '# V1 Preview', 'https://example.com/v1.mp4', '["v1","automation"]',
    7, 17500, 4.8, 5, 'published',
    NULL, 1700000100, 1700000000, 1700000200
  );

  INSERT INTO sop_licenses (
    id, user_id, template_id, listing_id, price_cents, payment_id, payment_status, purchased_at, refunded_at
  ) VALUES (
    'v1_lic_1', 'usr_2', 'v1_tmpl_1', 'v1_list_1', 2500, 'pay_123', 'paid', 1700000300, NULL
  );

  INSERT INTO user_sop_installations (
    id, user_id, template_id, customizations, schedule_cron, enabled, created_at
  ) VALUES (
    'pb_inst_1', 'usr_2', 'v1_tmpl_1', '{"webhookSecret":"sec"}', '0 9 * * *', 1, 1700000400
  );
`);

if (variant === 'non_allowlist_missing_0214') {
  db.exec(`DELETE FROM d1_migrations WHERE name LIKE '0214%';`);
} else if (variant === 'non_allowlist_0473_recorded') {
  db.exec(`INSERT INTO d1_migrations (name) VALUES ('0473_sop_installs_active_unique_index.sql');`);
} else if (variant === 'missing_prereq_creator_profiles') {
  db.exec(`DROP TABLE creator_profiles;`);
} else if (variant === 'partial_temp_table') {
  db.exec(`CREATE TABLE sop_listings_new (id TEXT PRIMARY KEY);`);
} else if (variant === 'partial_sop_installs_exists') {
  db.exec(`CREATE TABLE sop_installs (id TEXT PRIMARY KEY, listing_id TEXT, user_id TEXT, status TEXT);`);
} else if (variant === 'object_collision_view_sop_installs') {
  db.exec(`CREATE VIEW sop_installs AS SELECT id FROM sop_listings;`);
} else if (variant === 'object_collision_index_name') {
  db.exec(`CREATE INDEX idx_sop_reviews_rating ON sop_licenses(price_cents);`);
} else if (variant === 'cp_idx_user_id_wrong_def') {
  db.exec(`CREATE INDEX idx_creator_profiles_user_id ON creator_profiles(user_id, status);`);
} else if (variant === 'cp_idx_status_wrong_def') {
  db.exec(`CREATE UNIQUE INDEX idx_creator_profiles_status ON creator_profiles(status);`);
} else if (variant === 'cp_idx_tenant_id_wrong_def') {
  db.exec(`CREATE INDEX idx_creator_profiles_tenant_id ON creator_profiles(tenant_id) WHERE status = 'active';`);
} else if (variant === 'cp_idx_object_collision') {
  db.exec(`CREATE VIEW idx_creator_profiles_user_id AS SELECT id FROM creator_profiles;`);
} else if (variant === 'partial_v2_column_exists') {
  db.exec(`ALTER TABLE sop_listings ADD COLUMN creator_id TEXT;`);
} else if (variant === 'extra_unknown_column') {
  db.exec(`ALTER TABLE sop_listings ADD COLUMN mystery_extra_col TEXT;`);
} else if (variant === 'v1_col_metadata_mismatch') {
  db.exec(`
    DROP TABLE sop_listings;
    CREATE TABLE sop_listings (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL UNIQUE,
      price_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      preview_md TEXT,
      demo_video_url TEXT,
      tags TEXT,
      total_sales INTEGER DEFAULT 0,
      total_revenue_cents INTEGER DEFAULT 0,
      rating_avg REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('pending_review','published','rejected','suspended')) NOT NULL DEFAULT 'pending_review',
      rejection_reason TEXT,
      published_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX idx_listing_status ON sop_listings(status, published_at DESC);
    CREATE INDEX idx_listing_template ON sop_listings(template_id);
  `);
} else if (variant === 'unexpected_extra_v1_index') {
  db.exec(`CREATE INDEX idx_extra_unlisted ON sop_listings(tags);`);
} else if (variant === 'wrong_v1_index_definition') {
  db.exec(`
    DROP INDEX idx_listing_status;
    CREATE INDEX idx_listing_status ON sop_listings(status, published_at ASC);
  `);
} else if (variant === 'unexpected_view_dependency') {
  db.exec(`CREATE VIEW v_sop_listings_dep AS SELECT id FROM sop_listings;`);
} else if (variant === 'unexpected_fk_dependency') {
  db.exec(`CREATE TABLE custom_listing_audit (id TEXT PRIMARY KEY, listing_id TEXT REFERENCES sop_listings(id));`);
} else if (variant === 'unexpected_quoted_fk_dependency') {
  db.exec(`CREATE TABLE custom_quoted_fk_audit (id TEXT PRIMARY KEY, listing_id TEXT REFERENCES "sop_listings"(id));`);
} else if (variant === 'reconciled_with_duplicate_installs') {
  const sql0474 = fs.readFileSync(path.join(appDir, 'migrations/0474_reconcile_sop_marketplace_schema.sql'), 'utf8');
  db.exec(sql0474);
  db.exec(`
    INSERT INTO d1_migrations (name) VALUES
      ('0474_reconcile_sop_marketplace_schema'),
      ('0474_reconcile_sop_marketplace_schema.sql');
    INSERT INTO sop_installs (id, listing_id, user_id, license_id, price_cents, status, installed_at, tenant_id)
    VALUES
      ('inst_dup_1', 'v1_list_1', 'usr_2', 'lic_dup_1', 0, 'active', 1700000500, 'default'),
      ('inst_dup_2', 'v1_list_1', 'usr_2', 'lic_dup_2', 0, 'active', 1700000600, 'default');
  `);
} else if (variant === 'preexisting_0473_non_unique') {
  const sql0474 = fs.readFileSync(path.join(appDir, 'migrations/0474_reconcile_sop_marketplace_schema.sql'), 'utf8');
  db.exec(sql0474);
  db.exec(`
    INSERT INTO d1_migrations (name) VALUES
      ('0474_reconcile_sop_marketplace_schema'),
      ('0474_reconcile_sop_marketplace_schema.sql');
    CREATE INDEX idx_sop_installs_user_listing_active ON sop_installs(user_id, listing_id) WHERE status = 'active';
  `);
} else if (variant === 'preexisting_0473_wrong_columns') {
  const sql0474 = fs.readFileSync(path.join(appDir, 'migrations/0474_reconcile_sop_marketplace_schema.sql'), 'utf8');
  db.exec(sql0474);
  db.exec(`
    INSERT INTO d1_migrations (name) VALUES
      ('0474_reconcile_sop_marketplace_schema'),
      ('0474_reconcile_sop_marketplace_schema.sql');
    CREATE UNIQUE INDEX idx_sop_installs_user_listing_active ON sop_installs(listing_id, user_id) WHERE status = 'active';
  `);
} else if (variant === 'preexisting_0473_wrong_predicate') {
  const sql0474 = fs.readFileSync(path.join(appDir, 'migrations/0474_reconcile_sop_marketplace_schema.sql'), 'utf8');
  db.exec(sql0474);
  db.exec(`
    INSERT INTO d1_migrations (name) VALUES
      ('0474_reconcile_sop_marketplace_schema'),
      ('0474_reconcile_sop_marketplace_schema.sql');
    CREATE UNIQUE INDEX idx_sop_installs_user_listing_active ON sop_installs(user_id, listing_id) WHERE status = 'uninstalled';
  `);
} else if (variant === 'recorded_0473_wrong_definition') {
  const sql0474 = fs.readFileSync(path.join(appDir, 'migrations/0474_reconcile_sop_marketplace_schema.sql'), 'utf8');
  db.exec(sql0474);
  db.exec(`
    INSERT INTO d1_migrations (name) VALUES
      ('0474_reconcile_sop_marketplace_schema'),
      ('0474_reconcile_sop_marketplace_schema.sql'),
      ('0473_sop_installs_active_unique_index'),
      ('0473_sop_installs_active_unique_index.sql');
    CREATE UNIQUE INDEX idx_sop_installs_user_listing_active ON sop_installs(user_id, listing_id);
  `);
}

db.close();
NODE_INIT
}

create_sqlite_mock_wrangler() {
  local bin_path="$1"
  cat <<'EOF' > "$bin_path"
#!/usr/bin/env bash
set -euo pipefail
CMD=""
IS_FILE=0
FILE_PATH=""

echo "WRANGLER_ARGV: $*" >> "${TEST_ARGV_LOG:-/dev/null}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --command)
      CMD="$2"
      shift 2
      ;;
    --command=*)
      CMD="${1#*=}"
      shift
      ;;
    --file)
      IS_FILE=1
      FILE_PATH="$2"
      shift 2
      ;;
    --file=*)
      IS_FILE=1
      FILE_PATH="${1#*=}"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [ "$IS_FILE" -eq 1 ]; then
  echo "WRITE_FILE: $FILE_PATH" >> "$TEST_WRITE_LOG"
  echo "WRITE_FILE: $FILE_PATH" >> "$TEST_EVENT_LOG"
  if [ "${SIMULATE_MID_0474_FAILURE:-0}" = "1" ] && [[ "$FILE_PATH" == *"0474"* ]]; then
    node --no-warnings -e '
      const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(process.argv[1]);
      db.exec("CREATE TABLE sop_listings_new (id TEXT PRIMARY KEY);");
      db.close();
    ' "$MOCK_SQLITE_DB"
    echo "Simulated mid-execution failure during 0474" >&2
    exit 1
  fi
  node --no-warnings -e '
    const { DatabaseSync } = require("node:sqlite");
    const fs = require("node:fs");
    const db = new DatabaseSync(process.argv[1]);
    db.exec("PRAGMA foreign_keys = ON;");
    const sql = fs.readFileSync(process.argv[2], "utf8");
    db.exec("BEGIN IMMEDIATE;\n" + sql + "\nCOMMIT;");
    if (process.env.SIMULATE_POSTFLIGHT_0474_FAILURE === "1" && process.argv[2].includes("0474")) {
      db.exec("DROP INDEX idx_creator_profiles_tenant_id;");
    }
    db.close();
    process.stdout.write(JSON.stringify([{ results: [], success: true, meta: { changes: 1 } }]));
  ' "$MOCK_SQLITE_DB" "$FILE_PATH"
  exit 0
fi

if [ -n "$CMD" ]; then
  if [ "${SIMULATE_QUERY_ERROR_ON:-}" != "" ] && [[ "$CMD" == *"${SIMULATE_QUERY_ERROR_ON}"* ]]; then
    echo "Simulated D1 query failure on: $CMD" >&2
    exit 1
  fi

  first_word=$(echo "$CMD" | awk '{print toupper($1)}')
  case "$first_word" in
    INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE)
      echo "WRITE_COMMAND: $CMD" >> "$TEST_WRITE_LOG"
      echo "WRITE_COMMAND: $CMD" >> "$TEST_EVENT_LOG"
      ;;
  esac

  if [[ "$CMD" == *"idx_sop_installs_user_listing_active"* ]]; then
    echo "VERIFY_INDEX: $CMD" >> "$TEST_EVENT_LOG"
  fi

  node --no-warnings -e '
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(process.argv[1]);
    const sql = process.argv[2];
    const trimmed = sql.trim();
    if (/^(SELECT|PRAGMA)/i.test(trimmed)) {
      const stmt = db.prepare(trimmed);
      const rows = stmt.all();
      db.close();
      process.stdout.write(JSON.stringify([{ results: rows, success: true, meta: {} }]));
    } else {
      db.exec(trimmed);
      db.close();
      process.stdout.write(JSON.stringify([{ results: [], success: true, meta: { changes: 1 } }]));
    }
  ' "$MOCK_SQLITE_DB" "$CMD"
  exit 0
fi

echo '[{"results":[],"success":true,"meta":{}}]'
EOF
  chmod +x "$bin_path"
}

run_sqlite_reconcile_test() {
  local test_name="$1"
  local setup_variant="$2"
  local expected_exit="$3"
  local expected_pattern="$4"
  local expected_writes="$5"
  local extra_env="${6:-}"

  TESTS_RUN=$((TESTS_RUN + 1))
  echo -n "Test $TESTS_RUN: $test_name ... "

  local tmp_root
  tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/test-sqlite-reconcile.XXXXXX")
  local tmp_bin="$tmp_root/bin"
  local fixture_repo="$tmp_root/repo"
  local sqlite_db="$tmp_root/mock-d1.sqlite"
  mkdir -p "$tmp_bin" "$fixture_repo/scripts" "$fixture_repo/migrations"

  init_drifted_sqlite_db "$sqlite_db" "$setup_variant"
  create_sqlite_mock_wrangler "$tmp_bin/wrangler"

  cat <<EOF > "$tmp_bin/npx"
#!/usr/bin/env bash
echo "UNEXPECTED_NPX_INVOCATION: \$*" >> "\${TEST_ARGV_LOG:-/dev/null}"
exit 99
EOF
  chmod +x "$tmp_bin/npx"

  git -C "$fixture_repo" init -q
  git -C "$fixture_repo" config user.name "D1 Mock Harness"
  git -C "$fixture_repo" config user.email "d1-mock-harness@example.invalid"
  git -C "$fixture_repo" config core.hooksPath "$tmp_root/no-hooks"
  cp "$TARGET_SCRIPT" "$fixture_repo/scripts/apply-migrations.sh"
  printf '%s\n' "D1 migration test fixture" > "$fixture_repo/README.md"
  git -C "$fixture_repo" add scripts/apply-migrations.sh README.md
  git -C "$fixture_repo" -c commit.gpgsign=false commit -q -m "fixture baseline"

  cp "$APP_DIR/migrations/0473_sop_installs_active_unique_index.sql" "$fixture_repo/migrations/"
  cp "$APP_DIR/migrations/0474_reconcile_sop_marketplace_schema.sql" "$fixture_repo/migrations/"
  git -C "$fixture_repo" add migrations/0473_sop_installs_active_unique_index.sql migrations/0474_reconcile_sop_marketplace_schema.sql
  git -C "$fixture_repo" -c commit.gpgsign=false commit -q -m "add 0473 and 0474"

  local test_write_log="$tmp_bin/write_executed.log"
  local test_argv_log="$tmp_bin/argv.log"
  local test_event_log="$tmp_bin/events.log"
  local test_output="$tmp_bin/output.log"
  touch "$test_write_log" "$test_argv_log" "$test_event_log"

  local actual_exit=0
  (
    export PATH="$tmp_bin:$PATH"
    export MOCK_SQLITE_DB="$sqlite_db"
    export TEST_WRITE_LOG="$test_write_log"
    export TEST_ARGV_LOG="$test_argv_log"
    export TEST_EVENT_LOG="$test_event_log"
    unset CI GITHUB_ACTIONS NODE_ENV ENVIRONMENT CF_PAGES MIGRATIONS_OVERRIDE
    unset __D1_TEST_HARNESS_MIGRATIONS_DELTA __D1_MOCK_HARNESS_TOKEN
    export WRANGLER_CMD="$tmp_bin/wrangler"
    export WRANGLER_REMOTE_FLAG="--local"
    export DB_NAME="sophia-raas-db-mock"
    export WRANGLER_CONFIG="wrangler.mock.toml"
    if [ -n "$extra_env" ]; then
      export "$extra_env"
    fi
    cd "$fixture_repo"
    bash scripts/apply-migrations.sh HEAD~1 > "$test_output" 2>&1
  ) || actual_exit=$?

  local write_count
  write_count=$(wc -l < "$test_write_log" | tr -d ' ')

  if grep -q -- "--remote" "$test_argv_log"; then
    echo "FAILED! (--remote detected)"
    rm -rf "$tmp_root"
    exit 1
  fi
  if grep -q "UNEXPECTED_NPX_INVOCATION" "$test_argv_log"; then
    echo "FAILED! (npx invoked)"
    rm -rf "$tmp_root"
    exit 1
  fi
  if [ "$actual_exit" -ne "$expected_exit" ]; then
    echo "FAILED! (Expected exit $expected_exit, got $actual_exit)"
    cat "$test_output"
    rm -rf "$tmp_root"
    exit 1
  fi
  if [ -n "$expected_pattern" ] && ! grep -qE "$expected_pattern" "$test_output"; then
    echo "FAILED! (Pattern '$expected_pattern' not found)"
    cat "$test_output"
    rm -rf "$tmp_root"
    exit 1
  fi
  if [ "$write_count" -ne "$expected_writes" ]; then
    echo "FAILED! (Expected $expected_writes writes, got $write_count)"
    cat "$test_write_log"
    cat "$test_output"
    rm -rf "$tmp_root"
    exit 1
  fi

  # Additional assertions for mid-execution failure: second run must detect partial state with 0 writes
  if [ "${extra_env:-}" = "SIMULATE_MID_0474_FAILURE=1" ]; then
    : > "$test_write_log"
    local second_exit=0
    (
      export PATH="$tmp_bin:$PATH"
      export MOCK_SQLITE_DB="$sqlite_db"
      export TEST_WRITE_LOG="$test_write_log"
      export TEST_ARGV_LOG="$test_argv_log"
      export TEST_EVENT_LOG="$test_event_log"
      export WRANGLER_CMD="$tmp_bin/wrangler"
      export WRANGLER_REMOTE_FLAG="--local"
      export DB_NAME="sophia-raas-db-mock"
      export WRANGLER_CONFIG="wrangler.mock.toml"
      cd "$fixture_repo"
      bash scripts/apply-migrations.sh HEAD~1 > "$test_output.run2" 2>&1
    ) || second_exit=$?
    local second_writes
    second_writes=$(wc -l < "$test_write_log" | tr -d ' ')
    if [ "$second_exit" -ne 1 ] || [ "$second_writes" -ne 0 ] || ! grep -q "Partial rebuild state detected: temporary table 'sop_listings_new' exists" "$test_output.run2"; then
      echo "FAILED! (Second run after partial failure did not fail closed with 0 writes)"
      cat "$test_output.run2"
      rm -rf "$tmp_root"
      exit 1
    fi
  fi

  # Additional assertions for postflight failure: must NOT record 0474 in ledger and must NOT run 0473
  if [ "${extra_env:-}" = "SIMULATE_POSTFLIGHT_0474_FAILURE=1" ]; then
    if grep -q "INSERT OR IGNORE INTO d1_migrations" "$test_write_log" || grep -q "0473_sop_installs_active_unique_index" "$test_write_log"; then
      echo "FAILED! (Postflight failure still recorded ledger or executed 0473!)"
      cat "$test_write_log"
      rm -rf "$tmp_root"
      exit 1
    fi
  fi

  # Additional deep assertions for happy-path end-to-end SQLite reconciliation
  if [ "$setup_variant" = "standard_drift" ] && [ "$expected_exit" -eq 0 ]; then
    # 1. Verify execution order: 0474 file -> 0474 ledger -> 0473 file -> 0473 index verify -> 0473 ledger
    local l_0474_file l_0474_ledger l_0473_file l_0473_verify l_0473_ledger
    l_0474_file=$(grep -n '^WRITE_FILE: .*0474_reconcile_sop_marketplace_schema.sql' "$test_event_log" | head -n 1 | cut -d: -f1 || true)
    l_0474_ledger=$(grep -n "^WRITE_COMMAND: INSERT OR IGNORE INTO d1_migrations .*0474_reconcile_sop_marketplace_schema" "$test_event_log" | head -n 1 | cut -d: -f1 || true)
    l_0473_file=$(grep -n '^WRITE_FILE: .*0473_sop_installs_active_unique_index.sql' "$test_event_log" | head -n 1 | cut -d: -f1 || true)
    l_0473_verify=$(grep -n '^VERIFY_INDEX:' "$test_event_log" | tail -n 1 | cut -d: -f1 || true)
    l_0473_ledger=$(grep -n "^WRITE_COMMAND: INSERT OR IGNORE INTO d1_migrations .*0473_sop_installs_active_unique_index" "$test_event_log" | head -n 1 | cut -d: -f1 || true)

    if [ -z "$l_0474_file" ] || [ -z "$l_0474_ledger" ] || [ -z "$l_0473_file" ] || [ -z "$l_0473_verify" ] || [ -z "$l_0473_ledger" ] || \
       [ "$l_0474_file" -ge "$l_0474_ledger" ] || [ "$l_0474_ledger" -ge "$l_0473_file" ] || \
       [ "$l_0473_file" -ge "$l_0473_verify" ] || [ "$l_0473_verify" -ge "$l_0473_ledger" ]; then
      echo "FAILED! (Execution order violated: expected 0474 DDL -> 0474 ledger -> 0473 DDL -> 0473 verify -> 0473 ledger)"
      cat "$test_event_log"
      rm -rf "$tmp_root"
      exit 1
    fi

    # 2. Verify V1 data preservation, V1/V2 inserts, status constraints, and index postconditions in SQLite
    node --no-warnings - "$sqlite_db" <<'NODE_VERIFY'
const { DatabaseSync } = require('node:sqlite');
const assert = require('node:assert');
const db = new DatabaseSync(process.argv[2]);
db.exec('PRAGMA foreign_keys = ON;');

// Verify exact column counts (25 / 10 / 7) and foreign key integrity
assert.strictEqual(db.prepare(`SELECT COUNT(*) AS cnt FROM pragma_table_info('sop_listings')`).get().cnt, 25);
assert.strictEqual(db.prepare(`SELECT COUNT(*) AS cnt FROM pragma_table_info('sop_installs')`).get().cnt, 10);
assert.strictEqual(db.prepare(`SELECT COUNT(*) AS cnt FROM pragma_table_info('sop_reviews')`).get().cnt, 7);
assert.strictEqual(db.prepare(`SELECT foreign_keys FROM pragma_foreign_keys`).get().foreign_keys, 1);
assert.strictEqual(db.prepare(`SELECT defer_foreign_keys FROM pragma_defer_foreign_keys`).get().defer_foreign_keys, 0);
assert.strictEqual(db.prepare(`SELECT COUNT(*) AS cnt FROM pragma_foreign_key_check`).get().cnt, 0);

// Check V1 row preserved bit-for-bit without fake cross-schema template mapping
const v1Row = db.prepare(`SELECT * FROM sop_listings WHERE id = 'v1_list_1'`).get();
assert.strictEqual(v1Row.template_id, 'v1_tmpl_1');
assert.strictEqual(v1Row.price_cents, 2500);
assert.strictEqual(v1Row.currency, 'USD');
assert.strictEqual(v1Row.preview_md, '# V1 Preview');
assert.strictEqual(v1Row.demo_video_url, 'https://example.com/v1.mp4');
assert.strictEqual(v1Row.tags, '["v1","automation"]');
assert.strictEqual(v1Row.total_sales, 7);
assert.strictEqual(v1Row.total_revenue_cents, 17500);
assert.strictEqual(v1Row.rating_avg, 4.8);
assert.strictEqual(v1Row.rating_count, 5);
assert.strictEqual(v1Row.status, 'published');
assert.strictEqual(v1Row.published_at, 1700000100);
assert.strictEqual(v1Row.created_at, 1700000000);
assert.strictEqual(v1Row.updated_at, 1700000200);
assert.strictEqual(v1Row.tenant_id, 'default');
assert.strictEqual(v1Row.creator_id, null);
assert.strictEqual(v1Row.sop_template_id, null);

// Check V1 sop_licenses and user_sop_installations untouched
const lic = db.prepare(`SELECT * FROM sop_licenses WHERE id = 'v1_lic_1'`).get();
assert.strictEqual(lic.payment_status, 'paid');
const pb = db.prepare(`SELECT * FROM user_sop_installations WHERE id = 'pb_inst_1'`).get();
assert.strictEqual(pb.template_id, 'v1_tmpl_1');

// Check historical ledger rows (including id=677) untouched
const row677 = db.prepare(`SELECT id, name FROM d1_migrations WHERE id = 677`).get();
assert.strictEqual(row677.name, '0298_creator_reviews_marketplace');

// Test V1-only insert (provides template_id, omits V2 fields)
db.prepare(`
  INSERT INTO sop_listings (id, template_id, price_cents, currency, preview_md, demo_video_url, tags, status, created_at, updated_at)
  VALUES ('v1_list_new', 'v1_tmpl_new', 0, 'USD', NULL, NULL, NULL, 'pending_review', 1700001000, 1700001000)
`).run();

// Test V2-only insert (provides creator_id, title, sop_template_id; omits template_id)
db.prepare(`
  INSERT INTO sop_listings (id, creator_id, title, description, price_cents, category, tags, thumbnail_url, demo_video_url, sop_template_id, status, install_count, rating, created_at, updated_at, tenant_id)
  VALUES ('v2_list_new', 'cp_1', 'V2 SOP', 'Desc', 0, 'ops', '[]', NULL, NULL, 'v2_tmpl_1', 'draft', 0, 0, 1700001000, 1700001000, 'default')
`).run();

// Test all 6 valid statuses on sop_listings
for (const st of ['pending_review', 'published', 'rejected', 'suspended', 'draft', 'archived']) {
  db.prepare(`UPDATE sop_listings SET status = ? WHERE id = 'v2_list_new'`).run(st);
}

// Test invalid status is rejected by CHECK constraint
assert.throws(() => {
  db.prepare(`UPDATE sop_listings SET status = 'invalid_status' WHERE id = 'v2_list_new'`).run();
}, /CHECK constraint failed/);

// Test row with neither V1 template_id nor V2 (creator_id, title, sop_template_id) is rejected
assert.throws(() => {
  db.prepare(`
    INSERT INTO sop_listings (id, price_cents, status, created_at, updated_at)
    VALUES ('bad_list', 0, 'draft', 1700001000, 1700001000)
  `).run();
}, /CHECK constraint failed/);

// Test 0473 partial unique index on sop_installs (blocks duplicate active, allows reinstall after uninstalled)
db.prepare(`
  INSERT INTO sop_installs (id, listing_id, user_id, license_id, price_cents, status, installed_at, tenant_id)
  VALUES ('inst_1', 'v2_list_new', 'usr_2', 'lic_1', 0, 'active', 1700001100, 'default')
`).run();

assert.throws(() => {
  db.prepare(`
    INSERT INTO sop_installs (id, listing_id, user_id, license_id, price_cents, status, installed_at, tenant_id)
    VALUES ('inst_2', 'v2_list_new', 'usr_2', 'lic_2', 0, 'active', 1700001200, 'default')
  `).run();
}, /UNIQUE constraint failed/);

db.prepare(`UPDATE sop_installs SET status = 'uninstalled', uninstalled_at = 1700001300 WHERE id = 'inst_1'`).run();
db.prepare(`
  INSERT INTO sop_installs (id, listing_id, user_id, license_id, price_cents, status, installed_at, tenant_id)
  VALUES ('inst_3', 'v2_list_new', 'usr_2', 'lic_3', 0, 'active', 1700001400, 'default')
`).run();

db.close();
NODE_VERIFY

    # 3. Re-run apply-migrations.sh on the now-reconciled DB (idempotent second run)
    : > "$test_write_log"
    local rerun_exit=0
    (
      export PATH="$tmp_bin:$PATH"
      export MOCK_SQLITE_DB="$sqlite_db"
      export TEST_WRITE_LOG="$test_write_log"
      export TEST_ARGV_LOG="$test_argv_log"
      export TEST_EVENT_LOG="$test_event_log"
      export WRANGLER_CMD="$tmp_bin/wrangler"
      export WRANGLER_REMOTE_FLAG="--local"
      export DB_NAME="sophia-raas-db-mock"
      export WRANGLER_CONFIG="wrangler.mock.toml"
      cd "$fixture_repo"
      bash scripts/apply-migrations.sh HEAD~1 > "$test_output.rerun" 2>&1
    ) || rerun_exit=$?
    local rerun_writes
    rerun_writes=$(wc -l < "$test_write_log" | tr -d ' ')
    if [ "$rerun_exit" -ne 0 ] || [ "$rerun_writes" -ne 0 ] || ! grep -q "All done. Applied: 0 | Skipped: 2" "$test_output.rerun"; then
      echo "FAILED! (Idempotent re-run failed: exit=$rerun_exit, writes=$rerun_writes)"
      cat "$test_output.rerun"
      rm -rf "$tmp_root"
      exit 1
    fi
  fi

  echo "PASSED (exit=$actual_exit, writes_dispatched=$write_count)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  rm -rf "$tmp_root"
}

# Case 15: Missing d1_migrations table when 0474 is in delta halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: missing d1_migrations ledger table halts with 0 writes" \
  "missing_d1_migrations" \
  1 \
  "d1_migrations ledger table does not exist in sqlite_master" \
  0

# Case 16: Non-allowlist ledger state (missing 0214 in ledger) halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: non-allowlist ledger (0214 missing) halts with 0 writes" \
  "non_allowlist_missing_0214" \
  1 \
  "Ledger state does not match allowlisted 0474 reconciliation drift" \
  0

# Case 17: Non-allowlist ledger state (0473 already recorded before 0474) halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: non-allowlist ledger (0473 already recorded) halts with 0 writes" \
  "non_allowlist_0473_recorded" \
  1 \
  "Ledger state does not match allowlisted 0474 reconciliation drift" \
  0

# Case 18: Missing prerequisite table creator_profiles halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: missing prerequisite table creator_profiles halts with 0 writes" \
  "missing_prereq_creator_profiles" \
  1 \
  "Missing prerequisite table 'creator_profiles'" \
  0

# Case 19: Partial rebuild state (sop_listings_new exists) halts without cleanup and 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: leftover sop_listings_new temporary table halts with 0 writes" \
  "partial_temp_table" \
  1 \
  "Partial rebuild state detected: temporary table 'sop_listings_new' exists" \
  0

# Case 20: Partial state (sop_installs table already exists while 0474 unapplied) halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: unexpected sop_installs table before 0474 halts with 0 writes" \
  "partial_sop_installs_exists" \
  1 \
  "object-name collision in sqlite_master for sop_installs, sop_reviews, or target indexes" \
  0

# Case 21: Object-name collision (VIEW named sop_installs) halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: object-name collision (VIEW named sop_installs) halts with 0 writes" \
  "object_collision_view_sop_installs" \
  1 \
  "object-name collision in sqlite_master for sop_installs, sop_reviews, or target indexes" \
  0

# Case 22: Object-name collision (INDEX with target 0474 index name on another table) halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: object-name collision (target index name already taken) halts with 0 writes" \
  "object_collision_index_name" \
  1 \
  "object-name collision in sqlite_master for sop_installs, sop_reviews, or target indexes" \
  0

# Case 23: Partial state (V2 column already present on sop_listings) halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: unexpected V2 column on sop_listings before 0474 halts with 0 writes" \
  "partial_v2_column_exists" \
  1 \
  "expected exactly 16 V1 columns, found 17 total columns" \
  0

# Case 24: Unknown extra column on sop_listings halts before rebuild can drop it (0 writes)
run_sqlite_reconcile_test \
  "0474+0473 delta: unknown extra column on sop_listings halts with 0 writes" \
  "extra_unknown_column" \
  1 \
  "expected exactly 16 V1 columns, found 17 total columns" \
  0

# Case 25: V1 column metadata mismatch on sop_listings halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: V1 column metadata mismatch on sop_listings halts with 0 writes" \
  "v1_col_metadata_mismatch" \
  1 \
  "sop_listings column metadata does not match migration 0126 baseline" \
  0

# Case 26: Unexpected extra named index on sop_listings halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: unlisted named index on sop_listings halts with 0 writes" \
  "unexpected_extra_v1_index" \
  1 \
  "sop_listings indexes do not match expected V1 allowlist/definitions" \
  0

# Case 27: Wrong definition on V1 index idx_listing_status halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: wrong V1 index definition on sop_listings halts with 0 writes" \
  "wrong_v1_index_definition" \
  1 \
  "sop_listings indexes do not match expected V1 allowlist/definitions" \
  0

# Case 28: Unexpected view referencing sop_listings halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: unexpected view dependency on sop_listings halts with 0 writes" \
  "unexpected_view_dependency" \
  1 \
  "Found unexpected trigger\(s\)/view\(s\) \(1\) or inbound foreign key\(s\) \(0\) referencing sop_listings" \
  0

# Case 29: Unexpected inbound FK referencing sop_listings halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: unexpected inbound FK dependency on sop_listings halts with 0 writes" \
  "unexpected_fk_dependency" \
  1 \
  "Found unexpected trigger\(s\)/view\(s\) \(0\) or inbound foreign key\(s\) \(1\) referencing sop_listings" \
  0

# Case 30: Unexpected quoted inbound FK (REFERENCES "sop_listings") halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: quoted inbound FK (REFERENCES \"sop_listings\") halts with 0 writes" \
  "unexpected_quoted_fk_dependency" \
  1 \
  "Found unexpected trigger\(s\)/view\(s\) \(0\) or inbound foreign key\(s\) \(1\) referencing sop_listings" \
  0

# Case 31: Query failure during 0474 preflight halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: query error during 0474 preflight halts with 0 writes" \
  "standard_drift" \
  1 \
  "FATAL PREFLIGHT ERROR" \
  0 \
  "SIMULATE_QUERY_ERROR_ON=pragma_table_info('sop_listings')"

# Case 32: Mid-execution failure in 0474 does not record ledger, and subsequent run halts on partial state
run_sqlite_reconcile_test \
  "0474+0473 delta: mid-execution failure aborts without ledger write and blocks retry" \
  "standard_drift" \
  1 \
  "0474_reconcile_sop_marketplace_schema FAILED" \
  1 \
  "SIMULATE_MID_0474_FAILURE=1"

# Case 33: Postflight verification failure in 0474 refuses ledger write and aborts before 0473
run_sqlite_reconcile_test \
  "0474+0473 delta: postflight verification failure refuses ledger write and halts before 0473" \
  "standard_drift" \
  1 \
  "Critical schema verification failed for 0474_reconcile_sop_marketplace_schema" \
  1 \
  "SIMULATE_POSTFLIGHT_0474_FAILURE=1"

# Case 34: Duplicate active installs after 0474 halts 0473 preflight with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: duplicate active installs block 0473 with 0 writes" \
  "reconciled_with_duplicate_installs" \
  1 \
  "Found 1 duplicate active install groups in 'sop_installs'" \
  0

# Case 35: Pre-existing 0473 index with wrong uniqueness (non-unique) halts with 0 writes and no ledger write
run_sqlite_reconcile_test \
  "0474+0473 delta: pre-existing non-unique 0473 index rejected with 0 writes" \
  "preexisting_0473_non_unique" \
  1 \
  "Pre-existing object/index 'idx_sop_installs_user_listing_active' has an invalid definition" \
  0

# Case 36: Pre-existing 0473 index with wrong column order halts with 0 writes and no ledger write
run_sqlite_reconcile_test \
  "0474+0473 delta: pre-existing wrong-column 0473 index rejected with 0 writes" \
  "preexisting_0473_wrong_columns" \
  1 \
  "Pre-existing object/index 'idx_sop_installs_user_listing_active' has an invalid definition" \
  0

# Case 37: Pre-existing 0473 index with wrong predicate halts with 0 writes and no ledger write
run_sqlite_reconcile_test \
  "0474+0473 delta: pre-existing wrong-predicate 0473 index rejected with 0 writes" \
  "preexisting_0473_wrong_predicate" \
  1 \
  "Pre-existing object/index 'idx_sop_installs_user_listing_active' has an invalid definition" \
  0

# Case 38: Recorded 0473 in ledger with drifted non-partial index definition halts with 0 writes
run_sqlite_reconcile_test \
  "0474+0473 delta: recorded 0473 with non-partial index definition rejected with 0 writes" \
  "recorded_0473_wrong_definition" \
  1 \
  "Physical index 'idx_sop_installs_user_listing_active' exists but does not match required UNIQUE partial index definition" \
  0

# Case 39: Pre-existing idx_creator_profiles_user_id with extra key column halts before any DDL (0 writes)
run_sqlite_reconcile_test \
  "0474+0473 delta: wrong definition on idx_creator_profiles_user_id (extra key) halts with 0 writes" \
  "cp_idx_user_id_wrong_def" \
  1 \
  "Object-name collision or invalid index definition on creator_profiles index names" \
  0

# Case 40: Pre-existing idx_creator_profiles_status with wrong uniqueness halts before any DDL (0 writes)
run_sqlite_reconcile_test \
  "0474+0473 delta: wrong definition on idx_creator_profiles_status (UNIQUE) halts with 0 writes" \
  "cp_idx_status_wrong_def" \
  1 \
  "Object-name collision or invalid index definition on creator_profiles index names" \
  0

# Case 41: Pre-existing idx_creator_profiles_tenant_id with partial predicate halts before any DDL (0 writes)
run_sqlite_reconcile_test \
  "0474+0473 delta: wrong definition on idx_creator_profiles_tenant_id (partial) halts with 0 writes" \
  "cp_idx_tenant_id_wrong_def" \
  1 \
  "Object-name collision or invalid index definition on creator_profiles index names" \
  0

# Case 42: Object-name collision on idx_creator_profiles_user_id (VIEW) halts before any DDL (0 writes)
run_sqlite_reconcile_test \
  "0474+0473 delta: object-name collision on idx_creator_profiles_user_id (VIEW) halts with 0 writes" \
  "cp_idx_object_collision" \
  1 \
  "Object-name collision or invalid index definition on creator_profiles index names" \
  0

# Case 43: Full end-to-end SQLite reconciliation (0474 -> ghost-ledger recheck -> 0473), V1/V2 verification & idempotent rerun
run_sqlite_reconcile_test \
  "0474+0473 delta: end-to-end SQLite reconciliation, V1/V2 parity, and idempotent re-run" \
  "standard_drift" \
  0 \
  "All done. Applied: 2 \| Skipped: 0" \
  4

# ─────────────────────────────────────────────────────────────────────────────
# DEPLOY.YML STAGE 2A FAIL-CLOSED MIGRATION-BASE RESOLUTION HARNESS
# Extracts the actual Stage 2a run block from .github/workflows/deploy.yml
# and tests it against a temporary Git repo, mock curl, and spy apply-migrations.sh.
# ─────────────────────────────────────────────────────────────────────────────

run_deploy_stage2a_test() {
  local test_name="$1"
  local curl_mode="$2"
  local expected_exit="$3"
  local expected_pattern="$4"
  local expected_calls="$5"

  TESTS_RUN=$((TESTS_RUN + 1))
  echo -n "Test $TESTS_RUN: $test_name ... "

  local workflow_file="$APP_DIR/../../.github/workflows/deploy.yml"
  local tmp_root
  tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/test-deploy-stage2a.XXXXXX")
  local tmp_bin="$tmp_root/bin"
  local fixture_repo="$tmp_root/repo"
  mkdir -p "$tmp_bin" "$fixture_repo/scripts"

  # Verify Stage 2a retains its exact dry_run and skip_migrations guard in deploy.yml
  if ! grep -A 2 "Stage 2a: D1 Delta Migration" "$workflow_file" | grep -q 'if: \${{ inputs.skip_migrations != true && inputs.dry_run != true }}'; then
    echo "FAILED! (Stage 2a if-condition for skip_migrations / dry_run missing or altered)"
    rm -rf "$tmp_root"
    exit 1
  fi

  # Extract the exact shell script from Stage 2a run: | block in deploy.yml
  node --no-warnings - "$workflow_file" "$tmp_root/stage2a.sh" <<'EXTRACT_STAGE2A'
const fs = require('node:fs');
const [wfPath, outPath] = process.argv.slice(2);
const lines = fs.readFileSync(wfPath, 'utf8').split('\n');
const startIdx = lines.findIndex((l) => l.includes("Stage 2a: D1 Delta Migration"));
if (startIdx === -1) process.exit(2);
let runIdx = -1;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (/^\s*run:\s*\|/.test(lines[i])) {
    runIdx = i;
    break;
  }
}
if (runIdx === -1) process.exit(3);
const baseIndentMatch = lines[runIdx + 1].match(/^(\s+)/);
const indent = baseIndentMatch ? baseIndentMatch[1].length : 10;
const body = [];
for (let i = runIdx + 1; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim() === '') {
    body.push('');
    continue;
  }
  const curIndent = (line.match(/^(\s*)/) || ['', ''])[1].length;
  if (curIndent < indent) break;
  body.push(line.slice(indent));
}
fs.writeFileSync(outPath, body.join('\n') + '\n', 'utf8');
EXTRACT_STAGE2A

  git -C "$fixture_repo" init -q
  git -C "$fixture_repo" config user.name "Stage2a Test"
  git -C "$fixture_repo" config user.email "stage2a@example.invalid"
  git -C "$fixture_repo" config core.hooksPath "$tmp_root/no-hooks"
  printf '%s\n' "commit 1" > "$fixture_repo/README.md"
  git -C "$fixture_repo" add README.md
  git -C "$fixture_repo" -c commit.gpgsign=false commit -q -m "first commit"
  local valid_short_sha
  valid_short_sha=$(git -C "$fixture_repo" rev-parse --short=8 HEAD)

  printf '%s\n' "commit 2" >> "$fixture_repo/README.md"
  git -C "$fixture_repo" add README.md
  git -C "$fixture_repo" -c commit.gpgsign=false commit -q -m "second commit"

  local calls_log="$tmp_root/apply_calls.log"
  touch "$calls_log"

  # Spy scripts/apply-migrations.sh
  cat <<EOF > "$fixture_repo/scripts/apply-migrations.sh"
#!/usr/bin/env bash
echo "APPLY_CALL: \$*" >> "$calls_log"
exit 0
EOF
  chmod +x "$fixture_repo/scripts/apply-migrations.sh"

  # Mock curl binary (no network)
  cat <<EOF > "$tmp_bin/curl"
#!/usr/bin/env bash
case "$curl_mode" in
  http_error)
    echo "curl: (22) The requested URL returned error: 502" >&2
    exit 22
    ;;
  empty_sha)
    printf '%s' '{"shortSha":"","deployedAt":"2026-10-14T00:00:00Z"}'
    exit 0
    ;;
  missing_sha_field)
    printf '%s' '{"status":"ok"}'
    exit 0
    ;;
  invalid_format_sha)
    printf '%s' '{"shortSha":"HEAD~1"}'
    exit 0
    ;;
  unresolvable_sha)
    printf '%s' '{"shortSha":"deadbeef"}'
    exit 0
    ;;
  valid_sha)
    printf '%s' '{"shortSha":"${valid_short_sha}","deployedAt":"2026-10-14T00:00:00Z"}'
    exit 0
    ;;
esac
EOF
  chmod +x "$tmp_bin/curl"

  local test_output="$tmp_root/output.log"
  local actual_exit=0
  (
    export PATH="$tmp_bin:$PATH"
    cd "$fixture_repo"
    bash "$tmp_root/stage2a.sh" > "$test_output" 2>&1
  ) || actual_exit=$?

  local call_count
  call_count=$(wc -l < "$calls_log" | tr -d ' ')

  if [ "$actual_exit" -ne "$expected_exit" ]; then
    echo "FAILED! (Expected exit $expected_exit, got $actual_exit)"
    cat "$test_output"
    rm -rf "$tmp_root"
    exit 1
  fi
  if [ -n "$expected_pattern" ] && ! grep -qE "$expected_pattern" "$test_output"; then
    echo "FAILED! (Pattern '$expected_pattern' not found)"
    cat "$test_output"
    rm -rf "$tmp_root"
    exit 1
  fi
  if [ "$call_count" -ne "$expected_calls" ]; then
    echo "FAILED! (Expected $expected_calls calls to apply-migrations.sh, got $call_count)"
    cat "$calls_log"
    rm -rf "$tmp_root"
    exit 1
  fi
  if [ "$curl_mode" = "valid_sha" ]; then
    if ! grep -qx "APPLY_CALL: ${valid_short_sha}" "$calls_log"; then
      echo "FAILED! (Expected apply-migrations.sh to be called with exact SHA ${valid_short_sha})"
      cat "$calls_log"
      rm -rf "$tmp_root"
      exit 1
    fi
  fi

  echo "PASSED (exit=$actual_exit, apply_migrations_calls=$call_count)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  rm -rf "$tmp_root"
}

# Case 44: Stage 2a HTTP error from /api/version halts before apply-migrations.sh
run_deploy_stage2a_test \
  "deploy.yml Stage 2a: HTTP error on /api/version halts with 0 migration calls" \
  "http_error" \
  1 \
  "CRITICAL: Failed to fetch live version" \
  0

# Case 45: Stage 2a empty/missing shortSha halts before apply-migrations.sh
run_deploy_stage2a_test \
  "deploy.yml Stage 2a: empty shortSha in /api/version halts with 0 migration calls" \
  "empty_sha" \
  1 \
  "CRITICAL: Live /api/version response is missing 'shortSha'" \
  0

# Case 46: Stage 2a non-hex shortSha (e.g. HEAD~1) halts before apply-migrations.sh
run_deploy_stage2a_test \
  "deploy.yml Stage 2a: non-hex shortSha rejected with 0 migration calls" \
  "invalid_format_sha" \
  1 \
  "is not a valid 7-40 hex commit SHA" \
  0

# Case 47: Stage 2a unresolvable commit SHA halts before apply-migrations.sh
run_deploy_stage2a_test \
  "deploy.yml Stage 2a: unresolvable commit SHA halts with 0 migration calls" \
  "unresolvable_sha" \
  1 \
  "does not resolve to a commit in this checkout" \
  0

# Case 48: Stage 2a valid commit SHA invokes apply-migrations.sh exactly once with PREV_SHA
run_deploy_stage2a_test \
  "deploy.yml Stage 2a: valid live SHA calls apply-migrations.sh once with exact SHA" \
  "valid_sha" \
  0 \
  "Applying D1 delta migrations since " \
  1

echo "================================================================================"
echo "SUMMARY: $TESTS_PASSED / $TESTS_RUN tests passed successfully."
echo "Zero DDL or mutating command writes were dispatched on all preflight/ledger failure branches."
echo "Tests used temporary Git fixtures and a directly pinned mock binary; no --remote or real npx call was allowed."
echo "================================================================================"
