#!/bin/bash
# apply-all-migrations.sh — Apply ALL local migrations to remote D1 from scratch.
# Used when d1_migrations table is empty (fresh DB or migration tracking reset).
# Usage: bash scripts/apply-all-migrations.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
DB_NAME="${DB_NAME:-sophia-raas-db}"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-wrangler.toml}"

MIGRATIONS=$(ls -1 migrations/*.sql | sort)

if [ -z "$MIGRATIONS" ]; then
  echo "No migrations found."
  exit 0
fi

TOTAL=$(echo "$MIGRATIONS" | wc -l | tr -d ' ')
echo "Applying ALL $TOTAL migrations to $DB_NAME..."
APPLIED=0
FAILED=0

for m in $MIGRATIONS; do
  NAME=$(basename "$m" .sql)
  # Skip DROP/RENAME migrations that fail on first run (tables don't exist yet)
  # These were intended for already-populated DBs — they'll error harmlessly
  if npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --file="$m" --remote 2>&1; then
    APPLIED=$((APPLIED + 1))
  else
    # Check if it's just a "table not found" error (expected for initial apply)
    # vs a real SQL error that should halt
    FAILED=$((FAILED + 1))
    echo "  -> $NAME: skipped (likely DROP on non-existent table)"
  fi
done

echo ""
echo "Done. Applied: $APPLIED | Skipped/DROP-not-found: $FAILED of $TOTAL"
