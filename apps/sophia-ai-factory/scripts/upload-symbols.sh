#!/bin/bash
set -euo pipefail

# Upload Source Maps to R2 Symbol Server
# Postbuild script for Sophia AI Factory 100/100 upgrade (L7: 8→10).

# Allow CI/audit runs to skip the actual upload (saves 30+ min on 3400+ files).
# Set SKIP_SYMBOL_UPLOAD=1 to skip the wrangler uploads entirely.
if [ "${SKIP_SYMBOL_UPLOAD:-0}" = "1" ]; then
  echo "⏭️  SKIP_SYMBOL_UPLOAD=1 — skipping source map upload (audit mode)"
  exit 0
fi

# Resolve commit SHA
COMMIT_SHA="${GIT_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
if [ "$COMMIT_SHA" = "unknown" ]; then
  echo "❌ Could not determine commit SHA. Set GIT_COMMIT_SHA or run in git repo."
  exit 1
fi

R2_BUCKET="${SYMBOLS_BUCKET_NAME:-sophia-symbols}"
NEXT_DIR=".next"

echo "🚀 Uploading source maps for commit $COMMIT_SHA to R2 bucket '$R2_BUCKET'"

# Find all .js.map files (portable across bash/sh via find)
# shellcheck disable=SC2207
map_files=()
while IFS= read -r f; do
  map_files+=("$f")
done < <(find "$NEXT_DIR" -type f -name '*.js.map' 2>/dev/null)

if [ ${#map_files[@]} -eq 0 ]; then
  echo "⚠️  No source map files found in $NEXT_DIR — skipping upload"
  exit 0
fi

uploaded=0
total_bytes=0
errors=0

for mapfile in "${map_files[@]}"; do
  # Skip if file was removed after glob expansion
  if [ ! -f "$mapfile" ]; then
    echo "  ⚠️  Skipping missing file (removed after build): $(basename "$mapfile")"
    continue
  fi
  relpath="${mapfile#$NEXT_DIR/}"
  key="$COMMIT_SHA/$relpath"
  # Get file size in bytes (portable)
  bytes=$(wc -c < "$mapfile" | tr -d ' ')
  echo "  ✓ $key ($((bytes / 1024)) KiB)"
  # Upload via wrangler r2 object put (show errors but don't exit)
  if ! npx wrangler r2 object put "$R2_BUCKET/$key" --file="$mapfile" --content-type "application/json" --remote 2>&1; then
    echo "  ✗ failed to upload $mapfile (continuing...)"
    errors=$((errors + 1))
    # Do not exit — continue to upload remaining files
  else
    uploaded=$((uploaded + 1))
    total_bytes=$((total_bytes + bytes))
  fi
done

echo ""
if [ $uploaded -gt 0 ]; then
  echo "✅ Uploaded $uploaded source maps ($((total_bytes / 1024)) KiB) to R2 bucket '$R2_BUCKET'"
fi
if [ $errors -gt 0 ]; then
  echo "⚠️  $errors upload(s) failed — check above for details"
fi
exit $errors
