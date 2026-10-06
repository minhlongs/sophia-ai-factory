#!/bin/bash
# Check 4-layer architecture boundary violations (static and dynamic imports)
# Exit 1 if any violation found
# Anchored to run consistently from any caller directory

set -euo pipefail

# Anchor execution directory to package root (apps/sophia-ai-factory)
cd "$(dirname "$0")/.."

ERRORS=0

echo "🔍 Checking layer boundaries..."

# tree→land (forbidden)
TREE_LAND=$(grep -rnE "(from[[:space:]]+['\"\`]@/land|import[[:space:]]+['\"\`]@/land|import[[:space:]]*\([[:space:]]*['\"\`]@/land)" src/tree/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "index\.ts:.*barrel.*allowed" || true)
if [ -n "$TREE_LAND" ]; then
  echo "❌ tree→land violations (static or dynamic):"
  echo "$TREE_LAND"
  ERRORS=$((ERRORS+1))
fi

# tree→forest (forbidden)
TREE_FOREST=$(grep -rnE "(from[[:space:]]+['\"\`]@/forest|import[[:space:]]+['\"\`]@/forest|import[[:space:]]*\([[:space:]]*['\"\`]@/forest)" src/tree/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "index\.ts:.*barrel.*allowed" || true)
if [ -n "$TREE_FOREST" ]; then
  echo "❌ tree→forest violations (static or dynamic):"
  echo "$TREE_FOREST"
  ERRORS=$((ERRORS+1))
fi

# seed→tree/forest/land (forbidden — foundational)
SEED_UPPER=$(grep -rnE "(from[[:space:]]+['\"\`]@/(tree|forest|land)|import[[:space:]]+['\"\`]@/(tree|forest|land)|import[[:space:]]*\([[:space:]]*['\"\`]@/(tree|forest|land))" src/seed/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "quota-provider\.ts.*comment" || true)
if [ -n "$SEED_UPPER" ]; then
  echo "❌ seed→tree/forest/land violations (static or dynamic):"
  echo "$SEED_UPPER"
  ERRORS=$((ERRORS+1))
fi

# land→forest (forbidden — circular)
LAND_FOREST=$(grep -rnE "(from[[:space:]]+['\"\`]@/forest|import[[:space:]]+['\"\`]@/forest|import[[:space:]]*\([[:space:]]*['\"\`]@/forest)" src/land/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." || true)
if [ -n "$LAND_FOREST" ]; then
  echo "❌ land→forest violations (static or dynamic):"
  echo "$LAND_FOREST"
  ERRORS=$((ERRORS+1))
fi

# Banned imports
BANNED=$(grep -rnE "(from[[:space:]]+['\"\`]|import[[:space:]]+['\"\`]|import[[:space:]]*\([[:space:]]*['\"\`])@/(lib/auth|lib/subscription|lib/unified-tier-config|lib/tier-gate|core|db|config/|data/|oracle)" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ || true)
if [ -n "$BANNED" ]; then
  echo "❌ Banned import violations:"
  echo "$BANNED"
  ERRORS=$((ERRORS+1))
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS boundary violation categories found. Fix before commit."
  exit 1
fi

echo "✅ All layer boundaries clean (both static and dynamic imports verified)"
