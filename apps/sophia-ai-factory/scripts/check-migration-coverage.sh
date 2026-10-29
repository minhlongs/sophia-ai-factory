#!/usr/bin/env bash
# check-migration-coverage.sh
#
# Guards against the INC-2026-01 root cause: SQL files that declare CREATE
# TABLE but live OUTSIDE the canonical migrations/ folder that
# `scripts/apply-migrations.sh` walks. Those tables never reach production D1.
#
# This guard used to scan only `src/**/*.sql`, a directory that holds zero .sql
# files in this repo, so it reported "OK" after checking nothing. It now scans
# every .sql file in the worktree except the two canonical locations, and fails
# loudly when it has examined no file at all.
#
# How it works:
#   1. Collect canonical D1 table names from migrations/*.sql
#   2. For every other .sql file in the repo:
#      a. If it contains Postgres-only syntax (JSONB, gen_random_uuid,
#         CREATE POLICY, RETURNS TRIGGER $$, COMMENT ON, …) → treat as
#         Supabase target, skip the check.
#      b. Otherwise extract its CREATE TABLE statements; every table name
#         must also appear in canonical migrations/.
#   3. Fail if any orphan table is found, or if no file was examined at all.
#
# Usage:
#   bash scripts/check-migration-coverage.sh
#
# Exit codes:
#   0  all D1 CREATE TABLE statements have canonical matches
#   1  at least one orphan table found, or the scan covered no files

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Postgres / Supabase syntax markers — any one of these on its own is
# enough to classify the file as non-D1 and skip orphan detection.
PG_MARKERS='JSONB|gen_random_uuid|TEXT\[\]|ROW LEVEL SECURITY|CREATE POLICY|TO authenticated|UUID PRIMARY|RETURNS TRIGGER|\$\$|COMMENT ON|TIMESTAMP WITH TIME ZONE'

canonical_tables=$(grep -hioE 'create table (if not exists )?[a-zA-Z_][a-zA-Z0-9_]*' migrations/*.sql 2>/dev/null \
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

  # `|| true` must wrap the WHOLE pipeline, not just grep. Writing it as
  # `grep ... || true | awk` binds it to grep alone, and because `||` has lower
  # precedence than `|`, awk then only runs when grep FAILS — so every
  # successfully extracted CREATE TABLE skipped the awk and was compared as the
  # raw 'CREATE TABLE IF NOT EXISTS x' string, which never matches a table name.
  # Every real table would have been reported as an orphan, and the guard would
  # have been silenced rather than fixed. `sort -u` never fails, so this form is
  # safe under `set -o pipefail`.
  tables_in_file=$(grep -hioE 'create table (if not exists )?[a-zA-Z_][a-zA-Z0-9_]*' "$sql_file" 2>/dev/null \
    | awk '{print tolower($NF)}' \
    | sort -u) || tables_in_file=""

  [ -z "$tables_in_file" ] && continue

  checked=$((checked + 1))

  while IFS= read -r table; do
    if ! printf '%s\n' "$canonical_tables" | grep -qx "$table"; then
      echo "ORPHAN: ${sql_file}: '${table}' has no matching CREATE TABLE in migrations/"
      orphans_found=$((orphans_found + 1))
    fi
  done <<< "$tables_in_file"
# Scan every .sql file in the repo except the two canonical locations. Scanning
# only src/ was the defect that made this guard vacuous — see the header note.
done < <(find . -name "*.sql" -type f \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -not -path "./.next/*" \
  -not -path "./.open-next/*" \
  -not -path "./migrations/*" \
  -not -path "./src/seed/db/migrations/*" \
  -not -path "./backups/*" \
  2>/dev/null | sed 's|^\./||' | sort)

# A guard that found no .sql file anywhere must not report success. This is how
# the original defect hid: it scanned a directory containing zero .sql files,
# found no orphans, and printed OK. Skipped-as-Postgres files still count as
# examined — they prove the scan reached real files.
total_scanned=$((checked + skipped_pg))
if [ "$total_scanned" -eq 0 ]; then
  echo >&2
  echo "ERROR: this guard scanned 0 .sql files anywhere in the repo. Either every" >&2
  echo ".sql file now lives in migrations/, which would make this guard obsolete," >&2
  echo "or the scan path is wrong. Reporting OK would be dishonest — fix the path" >&2
  echo "or retire this script rather than letting it pass silently." >&2
  exit 1
fi

echo
echo "Migration coverage check:"
echo "  D1 files checked:       $checked"
echo "  Postgres files skipped: $skipped_pg"
echo "  Orphan tables:          $orphans_found"
echo "  Total files examined:   $total_scanned"

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

echo "OK — all D1 CREATE TABLE statements outside migrations/ have canonical migrations/ matches."
