#!/usr/bin/env bash
# check-migration-coverage.sh
#
# Guards against the INC-2026-01 root cause: SQL files in src/ that
# declare CREATE TABLE but live OUTSIDE the canonical migrations/ folder
# that `scripts/apply-migrations.sh` walks. Those tables never reach
# production D1.
#
# How it works:
#   1. Collect canonical D1 table names from migrations/*.sql
#   2. For each .sql file under src/:
#      a. If it contains Postgres-only syntax (JSONB, gen_random_uuid,
#         CREATE POLICY, RETURNS TRIGGER $$, COMMENT ON, …) → treat as
#         Supabase target, skip the check.
#      b. Otherwise extract its CREATE TABLE statements; every table name
#         must also appear in canonical migrations/.
#   3. Exit 1 with a helpful message if any orphans found.
#
# Usage:
#   bash scripts/check-migration-coverage.sh
#
# Exit codes:
#   0  all D1 CREATE TABLE statements have canonical matches
#   1  at least one orphan table found

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Postgres / Supabase syntax markers — any one of these on its own is
# enough to classify the file as non-D1 and skip orphan detection.
PG_MARKERS='JSONB|gen_random_uuid|TEXT\[\]|ROW LEVEL SECURITY|CREATE POLICY|TO authenticated|UUID PRIMARY|RETURNS TRIGGER|\$\$|COMMENT ON|TIMESTAMP WITH TIME ZONE'

canonical_tables=$(grep -hioE 'CREATE TABLE (IF NOT EXISTS )?[a-zA-Z_]+' migrations/*.sql 2>/dev/null \
  | awk '{print tolower($NF)}' \
  | sort -u)

if [ -z "$canonical_tables" ]; then
  echo "ERROR: no CREATE TABLE found in migrations/ — script aborted." >&2
  exit 1
fi

orphans_found=0
skipped_pg=0
checked=0

# Use find + while-read to avoid POSIX-sh array gotchas.
while IFS= read -r sql_file; do
  if grep -qiE "$PG_MARKERS" "$sql_file"; then
    skipped_pg=$((skipped_pg + 1))
    continue
  fi

  tables_in_file=$(grep -ioE 'CREATE TABLE (IF NOT EXISTS )?[a-zA-Z_]+' "$sql_file" \
    | awk '{print tolower($NF)}' \
    | sort -u)

  [ -z "$tables_in_file" ] && continue

  checked=$((checked + 1))

  while IFS= read -r table; do
    if ! printf '%s\n' "$canonical_tables" | grep -qx "$table"; then
      echo "ORPHAN: ${sql_file}: '${table}' has no matching CREATE TABLE in migrations/"
      orphans_found=$((orphans_found + 1))
    fi
  done <<< "$tables_in_file"
done < <(find src -name "*.sql" -type f 2>/dev/null | sort)

echo
echo "Migration coverage check:"
echo "  D1 files checked:       $checked"
echo "  Postgres files skipped: $skipped_pg"
echo "  Orphan tables:          $orphans_found"

if [ "$orphans_found" -gt 0 ]; then
  cat >&2 <<EOF

ACTION: for each orphan, either:
  1. Copy the CREATE TABLE into a new migrations/<NNNN>-<slug>.sql,
     then apply via:  bash scripts/apply-migrations.sh
  2. If the table is actually a Postgres/Supabase target, add a Postgres
     marker to the file header (e.g. -- TARGET: postgres-supabase) plus
     real syntax such as JSONB / TIMESTAMP WITH TIME ZONE so this guard
     skips it on the next run.

Context: incident INC-2026-01 (2026-05-10) had 3 silent-failing tables
for ~10 days due to this exact drift. See
docs/postmortems/2026-05-10-revenue-split-tables-missing.md
EOF
  exit 1
fi

echo "OK — all D1 CREATE TABLE statements in src/**/*.sql have canonical migrations/ matches."
