#!/usr/bin/env bash
# stitch-preflight.sh — Pre-flight validation for Stitch→Next.js pipeline
#
# Usage:
#   stitch-preflight.sh --files <glob-pattern>
#   stitch-preflight.sh --project <project-dir>
#   stitch-preflight.sh --i18n

set -euo pipefail

PROJECT_ROOT="${1:-.}"
REPORT_FILE="${STITCH_PREFLIGHT_REPORT:-}"

find_project_root() {
  local dir="${1:-$PWD}"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ] || [ -f "$dir/CLAUDE.md" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname -- "$dir")"
  done
  echo "$PWD"
}

ROOT=$(find_project_root "$PROJECT_ROOT")
MESSAGES_DIR="$ROOT/messages"

scan_files() {
  local pattern="$1"
  local files
  shopt -s nullglob
  files=($pattern)
  shopt -u nullglob

  local total=0 updated=0 stale=0 missing=0
  local stale_files=() updated_files=() missing_files=()

  for f in "${files[@]}"; do
    total=$((total + 1))
    if [ ! -f "$f" ]; then
      missing=$((missing + 1))
      missing_files+=("$f")
      continue
    fi

    local content
    content=$(cat "$f" 2>/dev/null || echo "")

    # Check for old purple theme signals
    if echo "$content" | grep -q "#D946EF\|#E879F9\|#FDF4FF\|#86198F"; then
      stale=$((stale + 1))
      stale_files+=("$f")
    elif echo "$content" | grep -q "#6366F1\|indigo-500"; then
      updated=$((updated + 1))
      updated_files+=("$f")
    else
      stale=$((stale + 1))
      stale_files+=("$f (unknown)")
    fi
  done

  echo "{\"total\":$total,\"updated\":$updated,\"stale\":$stale,\"missing\":$missing}"
}

scan_i18n() {
  local prefixes=()

  if [ -d "$MESSAGES_DIR" ]; then
    for f in "$MESSAGES_DIR"/*.json; do
      [ -f "$f" ] || continue
      local keys
      keys=$(python3 -c "
import json,sys
with open('$f') as fh:
  d=json.load(fh)
print('\n'.join(d.keys()))
" 2>/dev/null) || continue
      while IFS= read -r key; do
        [ -n "$key" ] && prefixes+=("$key")
      done <<< "$keys"
    done
  fi

  # Deduplicate
  local unique=()
  for p in "${prefixes[@]}"; do
    local found=0
    for u in "${unique[@]}"; do
      [ "$u" = "$p" ] && found=1 && break
    done
    [ "$found" -eq 0 ] && unique+=("$p")
  done

  # Output as JSON array
  printf '['
  local first=1
  for p in "${unique[@]}"; do
    [ "$first" -eq 1 ] && first=0 || printf ','
    printf '"%s"' "$p"
  done
  printf ']'
}

case "${1:-}" in
  --files)
    shift
    scan_files "$*"
    ;;
  --project)
    shift
    proj="${1:-$ROOT}"
    ROOT=$(find_project_root "$proj")
    MESSAGES_DIR="$ROOT/messages"

    i18n=$(scan_i18n)
    sections_report=$(scan_files "$ROOT/src/app/components/sections/*.tsx")

    cat << REPORT
{
  "project": "$ROOT",
  "sections": $sections_report,
  "i18nPrefixes": $i18n,
  "messagesDir": "$MESSAGES_DIR",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
REPORT
    ;;
  --i18n)
    scan_i18n
    ;;
  *)
    cat << HELP
stitch-preflight.sh — Pre-flight validation for Stitch→Next.js pipeline

Usage:
  --files <glob>          Scan files for theme status
  --project [dir]         Full project scan (sections + i18n)
  --i18n                  Extract i18n prefixes only
HELP
    ;;
esac
