#!/usr/bin/env bash
# Sophia Factory — Agent Journal Writer
#
# Appends a journal entry to .sophia-factory/journal/ with PII scrub + filename
# pattern that matches scripts/agent-self-review/summarize.py expectations:
#
#   {YYYY-MM-DD}-{agent}-{slug}.md
#
# Stdin = entry body (markdown). PII-scrubbed via scrub-pii.sh.
#
# Usage:
#   echo "## Action\n..." | scripts/agent-journal/append-entry.sh cto wire-otel
#   scripts/agent-journal/append-entry.sh cmo blog-launch < draft.md
#
# Exit codes:
#   0 = written
#   1 = bad agent name
#   2 = bad slug (must be kebab-case, [a-z0-9-]+)
#   3 = duplicate filename (would overwrite)

set -euo pipefail

AGENT="${1:-}"
SLUG="${2:-}"

VALID_AGENTS="cto cmo cso coo orchestrator"
case " $VALID_AGENTS " in
  *" $AGENT "*) ;;
  *) echo "ERROR: agent must be one of: $VALID_AGENTS" >&2; exit 1 ;;
esac

if [[ -z "$SLUG" || ! "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "ERROR: slug must be kebab-case [a-z0-9-]+ (got: '$SLUG')" >&2
  exit 2
fi

# Cap slug length to keep filenames readable + prevent absurd input
if [[ ${#SLUG} -gt 60 ]]; then
  echo "ERROR: slug too long (${#SLUG} chars; max 60)" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
JOURNAL_DIR="$REPO_ROOT/.sophia-factory/journal"
SCRUB_SCRIPT="$REPO_ROOT/scripts/agent-journal/scrub-pii.sh"
DATE_STAMP="$(date -u +%Y-%m-%d)"
OUT_PATH="$JOURNAL_DIR/${DATE_STAMP}-${AGENT}-${SLUG}.md"

mkdir -p "$JOURNAL_DIR"

if [[ -e "$OUT_PATH" ]]; then
  echo "ERROR: journal entry already exists at $OUT_PATH" >&2
  exit 3
fi

if [[ ! -x "$SCRUB_SCRIPT" ]]; then
  echo "ERROR: scrubber not executable at $SCRUB_SCRIPT" >&2
  exit 1
fi

# Header + scrubbed body
{
  echo "---"
  echo "agent: $AGENT"
  echo "date: $DATE_STAMP"
  echo "slug: $SLUG"
  echo "---"
  echo
  "$SCRUB_SCRIPT"
} <&0 > "$OUT_PATH"

echo "$OUT_PATH"
