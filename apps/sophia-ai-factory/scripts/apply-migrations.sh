#!/bin/bash
# apply-migrations.sh — Apply D1 migrations not yet applied to remote.
# Usage: bash scripts/apply-migrations.sh [REF]
#   REF: git ref to compare against HEAD (default: HEAD~1)
#   Example: bash scripts/apply-migrations.sh HEAD~3
set -euo pipefail

REF="${1:-HEAD~1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==> Checking for migrations changed since $REF..."
# --relative emits paths relative to CWD (apps/sophia-ai-factory/) so the
# `[ -f "$m" ]` check + `wrangler --file=$m` resolve correctly. Without it,
# git returns repo-root-relative paths (apps/sophia-ai-factory/migrations/...)
# which double up after the `cd "$SCRIPT_DIR/.."` above.
MIGRATIONS=$(git diff --name-only --relative "$REF" HEAD -- migrations/ 2>/dev/null | grep -E "\.sql$" || true)

if [ -z "$MIGRATIONS" ]; then
  echo "No new migrations to apply."
  exit 0
fi

echo "==> Migrations to apply:"
echo "$MIGRATIONS"
echo ""

for m in $MIGRATIONS; do
  if [ ! -f "$m" ]; then
    echo "⚠️  File not found (may have been deleted): $m — skipping"
    continue
  fi
  echo "==> Applying $(basename $m)"
  npx wrangler d1 execute sophia-raas-db --file="$m" --remote
done

echo ""
echo "✅ All migrations applied."
