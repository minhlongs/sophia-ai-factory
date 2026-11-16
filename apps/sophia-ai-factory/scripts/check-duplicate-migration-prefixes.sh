#!/usr/bin/env bash
# check-duplicate-migration-prefixes.sh
#
# CI guard against duplicate migration-number prefixes in migrations/*.sql.
# Portable across macOS Bash 3.2 and Linux Bash 5+.
#
# Historical grandfather allowlist:
#   Prefix 0485 has two already-applied production migrations recorded in
#   d1_migrations (0485_better_auth_account_token_columns.sql and
#   0485_campaign_approval_lifecycle.sql). Renaming already-applied files would
#   desynchronize production migration history, so only that exact pair is
#   grandfathered while any 3rd 0485 file or any new collision fails closed.
#
# Exit codes:
# 0   all prefixes unique (excluding exact grandfathered historical pair)
# 1   one or more unauthorized duplicate prefixes found
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR_OVERRIDE:-${REPO_ROOT}/migrations}"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "❌ migrations/ directory not found at ${MIGRATIONS_DIR}" >&2
  exit 1
fi

is_grandfathered_pair() {
  local prefix="$1"
  local files_csv="$2"
  if [[ "$prefix" == "0485" ]] && \
     [[ "$files_csv" == "0485_better_auth_account_token_columns.sql 0485_campaign_approval_lifecycle.sql" ]]; then
    return 0
  fi
  return 1
}

tmp_pairs="$(mktemp "${TMPDIR:-/tmp}/mig-prefixes.XXXXXX")"
trap 'rm -f "$tmp_pairs"' EXIT

total_count=0
max_prefix=0

while IFS= read -r file; do
  base="${file##*/}"
  prefix="$(printf '%s\n' "$base" | grep -oE '^[0-9]+' || true)"
  if [[ -n "$prefix" ]]; then
    printf '%s\t%s\n' "$prefix" "$base" >> "$tmp_pairs"
    total_count=$((total_count + 1))
    num=$((10#$prefix))
    if [[ "$num" -gt "$max_prefix" ]]; then
      max_prefix="$num"
    fi
  fi
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | sort)

if [[ "$total_count" -eq 0 ]]; then
  echo "ℹ️  no numeric-prefix migrations found under ${MIGRATIONS_DIR}"
  exit 0
fi

duplicates=()
grandfathered_count=0

while IFS= read -r prefix; do
  [[ -z "$prefix" ]] && continue
  files_for_prefix="$(awk -F'\t' -v p="$prefix" '$1 == p { print $2 }' "$tmp_pairs" | sort | paste -sd ' ' -)"
  file_count="$(printf '%s\n' "$files_for_prefix" | wc -w | tr -d ' ')"
  if [[ "$file_count" -gt 1 ]]; then
    if is_grandfathered_pair "$prefix" "$files_for_prefix"; then
      grandfathered_count=$((grandfathered_count + 1))
    else
      duplicates+=("${prefix}|${files_for_prefix}")
    fi
  fi
done < <(cut -f1 "$tmp_pairs" | sort -u)

next_prefix="$(printf '%04d' $((max_prefix + 1)))"

if [[ ${#duplicates[@]} -eq 0 ]]; then
  echo "✅ ${total_count} migrations checked (${grandfathered_count} grandfathered historical collision: 0485). Next prefix: ${next_prefix}"
  exit 0
fi

echo "❌ DUPLICATE MIGRATION PREFIXES DETECTED — fix before creating new migrations" >&2
echo "" >&2
for entry in "${duplicates[@]}"; do
  prefix="${entry%%|*}"
  rest="${entry#*|}"
  file_count="$(printf '%s\n' "$rest" | wc -w | tr -d ' ')"
  echo "  prefix ${prefix}  (${file_count} files):" >&2
  for f in $rest; do
    echo "    - ${f}" >&2
  done
done
echo "" >&2
echo "Next available prefix: ${next_prefix}" >&2
echo "How to fix: rename the newer unapplied file(s) to an unused prefix (${next_prefix}+)." >&2
exit 1
