#!/usr/bin/env bash
# check-bundle-size.sh — CF Workers bundle size guard
# Thresholds: WARN at 9.5MB compressed, FAIL at 10MB compressed (CF limit)
# Exit code: 0 = OK/WARN, 1 = FAIL

set -euo pipefail

WORKER_FILE=".open-next/server-functions/default/handler.mjs"
WARN_MB=9.5
FAIL_MB=10.0

if [ ! -f "$WORKER_FILE" ]; then
  echo "⚠️  Bundle file not found: $WORKER_FILE (run npm run build first)"
  exit 0
fi

# Compute gzipped size in bytes
GZIP_BYTES=$(gzip -c "$WORKER_FILE" | wc -c | tr -d ' ')
GZIP_MB=$(echo "scale=2; $GZIP_BYTES / 1048576" | bc)

# Compare using awk for float comparison
WARN_EXCEEDED=$(awk -v size="$GZIP_MB" -v warn="$WARN_MB" 'BEGIN { print (size >= warn) ? "yes" : "no" }')
FAIL_EXCEEDED=$(awk -v size="$GZIP_MB" -v fail="$FAIL_MB" 'BEGIN { print (size >= fail) ? "yes" : "no" }')

if [ "$FAIL_EXCEEDED" = "yes" ]; then
  echo "❌ Bundle: ${GZIP_MB} MB compressed — EXCEEDED CF 10MB limit!"
  exit 1
elif [ "$WARN_EXCEEDED" = "yes" ]; then
  echo "⚠️  Bundle: ${GZIP_MB} MB compressed — APPROACHING LIMIT (limit 10MB)"
  exit 0
else
  echo "✅ Bundle: ${GZIP_MB} MB compressed (limit 10MB)"
  exit 0
fi
