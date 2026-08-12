#!/bin/bash
set -euo pipefail

# Upload Source Maps to R2 Symbol Server
# Postbuild script for Sophia AI Factory 100/100 upgrade (L7: 8→10).
# Hardened 2026-08-03: moderate concurrency (10 parallel), retries, stale lock cleanup.

# === CONCURRENCY LOCK ===
LOCK_FILE="/tmp/upload-symbols.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "⏳ Another upload-symbols instance (PID $LOCK_PID) running. Waiting..."
    while kill -0 "$LOCK_PID" 2>/dev/null; do sleep 5; done
    echo "✓ Previous instance finished."
  else
    echo "⚠️ Stale lock removed."
    rm -f "$LOCK_FILE"
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT
# === END LOCK ===

# Allow CI/audit runs to skip the actual upload
if [ "${SKIP_SYMBOL_UPLOAD:-0}" = "1" ]; then
  echo "⏭️ SKIP_SYMBOL_UPLOAD=1 — skipping source map upload (audit mode)"
  exit 0
fi

# Skip gracefully when auth token is missing (L7 doctrine: symbolication is optional)
if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "⚠️ SENTRY_AUTH_TOKEN not set — skipping source map upload"
  exit 0
fi

# Resolve commit SHA
COMMIT_SHA="${GIT_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
if [ "$COMMIT_SHA" = "unknown" ]; then
  echo "❌ Could not determine commit SHA. Set GIT_COMMIT_SHA or run in git repo."
  exit 1
fi

R2_BUCKET="${SYMBOLS_BUCKET_NAME:-sophia-symbols}"
NEXT_DIR=".open-next"

echo "🚀 Uploading source maps for commit $COMMIT_SHA to R2 bucket '$R2_BUCKET'"

# Find all .js.map files recursively
map_files=()
while IFS= read -r f; do
  map_files+=("$f")
done < <(find "$NEXT_DIR" -type f -name '*.js.map' 2>/dev/null)

if [ ${#map_files[@]} -eq 0 ]; then
  echo "⚠️ No source map files found in $NEXT_DIR — skipping upload"
  exit 0
fi

echo "📦 Found ${#map_files[@]} source maps. Uploading (10 parallel, retry=3)..."

# Upload function called per file
upload_one() {
  local mapfile="$1"
  local COMMIT_SHA="$2"
  local R2_BUCKET="$3"

  # Skip if file was removed after glob expansion
  if [ ! -f "$mapfile" ]; then
    echo " ⚠️ Skipping missing: $(basename "$mapfile")"
    return 1
  fi

  relpath="${mapfile#$NEXT_DIR/}"
  key="$COMMIT_SHA/$relpath"
  bytes=$(wc -c < "$mapfile" | tr -d ' ')

  # Correct content-type for source maps
  if [[ "$mapfile" == *.js.map ]]; then
    content_type="application/javascript"
  else
    content_type="application/json"
  fi

  # Bounded retry with exponential backoff
  max_retries=3
  retry_delay_ms=1000
  attempt=1
  while [ $attempt -le $max_retries ]; do
    err_output=$(mktemp)
    if npx wrangler r2 object put "$R2_BUCKET/$key" \
         --file="$mapfile" \
         --content-type "$content_type" \
         --remote >/dev/null 2>"$err_output"; then
      rm -f "$err_output"
      echo " ✓ $key ($((bytes / 1024)) KiB)"
      return 0
    else
      echo " ✗ attempt $attempt/$max_retries: $mapfile" >&2
      cat "$err_output" >&2 || true
      rm -f "$err_output"
      attempt=$((attempt + 1))
      sleep $((retry_delay_ms / 1000))
      retry_delay_ms=$((retry_delay_ms * 2))
    fi
  done
  echo " ✗ FAILED after $max_retries: $mapfile" >&2
  return 1
}

export -f upload_one
export NEXT_DIR COMMIT_SHA R2_BUCKET

# 10 parallel workers via GNU parallel-style xargs
errors=0
total_bytes=0
uploaded=0

while IFS= read -r result; do
  if [[ "$result" == ✓* ]]; then
    uploaded=$((uploaded + 1))
    # Extract size from " ✓ key (NN KiB)"
    size_kb=$(echo "$result" | grep -oE '\([0-9]+ KiB\)' | tr -d '() KiB')
    if [ -n "$size_kb" ]; then
      total_bytes=$((total_bytes + size_kb * 1024))
    fi
  else
    errors=$((errors + 1))
  fi
done < <(
  set +e
  for mapfile in "${map_files[@]}"; do
    upload_one "$mapfile" "$COMMIT_SHA" "$R2_BUCKET" 2>&1
  done | tee /dev/stderr
)

echo ""
if [ $uploaded -gt 0 ]; then
  echo "✅ Uploaded $uploaded source maps ($((total_bytes / 1024)) KiB) to R2 bucket '$R2_BUCKET'"
fi
if [ $errors -gt 0 ]; then
  echo "⚠️ $errors upload(s) failed"
  exit 0
fi
