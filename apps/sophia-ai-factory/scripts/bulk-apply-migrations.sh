#!/bin/bash
# bulk-apply-migrations.sh — Apply all local migrations to remote D1 that aren't already tracked.
# Uses --stdin to avoid wrangler's file-upload cache (which would serve a stale combined SQL).
# Records each applied migration in d1_migrations to skip on re-runs.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
DB_NAME="${DB_NAME:-sophia-raas-db}"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-wrangler.toml}"

MIGRATIONS=$(ls -1 migrations/*.sql | sort)
TOTAL=$(echo "$MIGRATIONS" | wc -l | tr -d ' ')
echo "Found $TOTAL migration files. Applying via stdin (bypasses file cache)..."

APPLIED=0
FAILED=0
SKIPPED=0
ERRORS=""

for m in $MIGRATIONS; do
  NAME=$(basename "$m" .sql)

  # Check if already recorded (small file via --stdin to avoid cache)
  TMP=$(mktemp -t mig-check)
  cat > "$TMP" <<CHECKSQL
SELECT COUNT(*) AS cnt FROM d1_migrations WHERE name = '$NAME';
CHECKSQL
  if npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --stdin --remote < "$TMP" >/dev/null 2>&1; then
    # Parse count from result by checking the output
    COUNT_OUT=$(npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --stdin --remote < "$TMP" 2>${TMP}.err | grep -o '"cnt":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
    COUNT=${COUNT_OUT:-0}
  else
    COUNT=0
  fi
  rm -f "$TMP" "${TMP}.err"

  if [ "${COUNT:-0}" -gt 0 ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  → $NAME..."
  # Apply via stdin (bypasses file-upload cache completely)
  if cat "$m" | npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --stdin --remote >/dev/null 2>&1; then
    # Record success
    TMP=$(mktemp -t mig-record)
    cat > "$TMP" <<RECORDSQL
INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('$NAME', datetime('now'));
RECORDSQL
    cat "$TMP" | npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --stdin --remote >/dev/null 2>&1
    rm -f "$TMP"
    APPLIED=$((APPLIED + 1))
    echo "  ✅ $NAME"
  else
    # Record anyway to prevent infinite retries
    TMP=$(mktemp -t mig-record)
    cat > "$TMP" <<RECORDSQL
INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('$NAME', datetime('now'));
RECORDSQL
    cat "$TMP" | npx wrangler d1 execute "$DB_NAME" --config "$WRANGLER_CONFIG" --stdin --remote >/dev/null 2>&1
    rm -f "$TMP"
    FAILED=$((FAILED + 1))
    ERRORS="$ERRORS\n  ❌ $NAME"
    echo "  ❌ $NAME"
  fi
done

echo ""
echo "Done. Applied: $APPLIED | Skipped: $SKIPPED | Failed: $FAILED | Total: $TOTAL"
if [ -n "$ERRORS" ]; then
  echo ""
  echo "FAILED MIGRATIONS:$ERRORS"
  echo ""
  echo "Review these individually: they may need ORDER changes or manual fixes."
  exit 1
fi
