#!/usr/bin/env bash
# check-duplicate-migration-prefixes.sh
#
# CI guard against duplicate migration-number prefixes in migrations/*.sql.
#
# What it checks:
#   Each migration filename is expected to start with a zero-padded numeric
#   prefix (e.g. 0047-user-purchases-underpaid.sql).  wrangler d1
#   migrations create uses that prefix as the sequence key, so any duplicate
#   makes the next created migration collide in the d1_migrations table.
#
# Exit codes:
# 0   all prefixes unique
# 1   one or more duplicate prefixes found
#
# Run:
#   bash scripts/check-duplicate-migration-prefixes.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/migrations"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "❌ migrations/ directory not found at ${MIGRATIONS_DIR}" >&2
  exit 1
fi

# Collect numeric prefixes. Files without a leading numeric prefix (e.g. the
# baseline double-file 0118_d1_migrations_baseline*.sql) are intentionally
# ignored by this guard — they are not sequenced by wrangler.
prefixes=()
names=()
while IFS= read -r file; do
  base="${file##*/}"
  prefix="$(echo "$base" | grep -oE '^[0-9]+' || true)"
  if [[ -n "$prefix" ]]; then
    prefixes+=("$prefix")
    names+=("$base")
  fi
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | sort)

if [[ ${#prefixes[@]} -eq 0 ]]; then
  echo "ℹ️  no numeric-prefix migrations found under ${MIGRATIONS_DIR}"
  exit 0
fi

# Build index of prefix -> list(N)
declare -A by_prefix
for i in "${!prefixes[@]}"; do
  p="${prefixes[$i]}"
  by_prefix["$p"]="${by_prefix["$p"]:+${by_prefix["$p"]} }${names[$i]}"
done

# Find duplicates
duplicates=()
for prefix in "${!by_prefix[@]}"; do
  count="${by_prefix["$prefix"]}"
  file_count=$(echo "$count" | wc -w | tr -d ' ')
  if [[ "$file_count" -gt 1 ]]; then
    duplicates+=("$prefix|${count}")
  fi
done

if [[ ${#duplicates[@]} -eq 0 ]]; then
  count=${#prefixes[@]}
  max_prefix="$(printf '%s\n' "${prefixes[@]}" | sort -n | tail -1)"
  echo "✅ ${count} migrations, all ${count} prefixes unique. Next prefix: $(printf '%04d' $((10#$max_prefix + 1)))"
  exit 0
fi

echo "❌ DUPLICATE MIGRATION PREFIXES DETECTED — fix before creating new migrations" >&2
echo "" >&2
for entry in "${duplicates[@]}"; do
  prefix="${entry%%|*}"
  rest="${entry#*|}"
  file_count=$(echo "$rest" | wc -w | tr -d ' ')
  echo "  prefix ${prefix}  (${file_count} files):" >&2
  for f in $rest; do
    echo "    - ${f}" >&2
  done
done
echo "" >&2
echo "Next available prefix: $(printf '%04d' $(( $(printf '%s\n' "${prefixes[@]}" | sort -n | tail -1) + 1 )))" >&2
echo "How to fix: rename the newer file(s) to an unused prefix, e.g. sed -i '' 's/^NNNN-/NNNN-new-/'" >&2
exit 1
