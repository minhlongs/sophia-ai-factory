#!/usr/bin/env bash
# CI check: ban new `await getD1*()` calls.
# Per CLAUDE.md: createServerClient()/getD1() are SYNC — do NOT await.
# Async wrappers (getD1Raw, getD1Safe, getD1Client) are @deprecated.
#
# Allow-list:
#   - The deprecated wrappers themselves in client.ts (annotated @deprecated)
#   - Tests under __tests__/ (mock these for unit tests)
#
# This is a soft fail: reports count + exit 1 if new violations exceed baseline.

set -euo pipefail

BASELINE_FILE="$(dirname "$0")/../.baseline-async-d1-count"
CURRENT_COUNT=$(rg "await getD1(Raw|Safe|Client)?\b" --type ts -g '!src/seed/db/client.ts' -g '!**/__tests__/**' 2>/dev/null | wc -l | tr -d ' ')

echo "async D1 calls (excluding deprecated source + tests): $CURRENT_COUNT"

if [ -f "$BASELINE_FILE" ]; then
  BASELINE=$(cat "$BASELINE_FILE")
  echo "baseline: $BASELINE"
  if [ "$CURRENT_COUNT" -gt "$BASELINE" ]; then
    echo "❌ FAIL: $((CURRENT_COUNT - BASELINE)) new await getD1*() calls added."
    echo "   Per CLAUDE.md: getD1() is synchronous. Use 'const db = getD1()' not 'const db = await getD1Raw()'."
    echo "   New offenders:"
    rg "await getD1(Raw|Safe|Client)?\b" --type ts -g '!src/seed/db/client.ts' -g '!**/__tests__/**' 2>/dev/null | head -20
    exit 1
  fi
  echo "✅ Within baseline."
else
  echo "ℹ️  No baseline file. Recording $CURRENT_COUNT as baseline."
  echo "$CURRENT_COUNT" > "$BASELINE_FILE"
  echo "Future runs will fail if this grows."
fi
