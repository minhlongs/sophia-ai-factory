#!/bin/bash
# Check 4-layer architecture boundary violations
# Exit 1 if any violation found
# Run from: apps/sophia-ai-factory/

set -euo pipefail
ERRORS=0

echo "🔍 Checking layer boundaries..."

# tree→land (forbidden)
TREE_LAND=$(grep -rn "from ['\"]@/land" src/tree/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "index\.ts:.*barrel.*allowed" || true)
if [ -n "$TREE_LAND" ]; then
  echo "❌ tree→land violations:"
  echo "$TREE_LAND"
  ERRORS=$((ERRORS+1))
fi

# tree→forest (forbidden)
TREE_FOREST=$(grep -rn "from ['\"]@/forest" src/tree/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "index\.ts:.*barrel.*allowed" || true)
if [ -n "$TREE_FOREST" ]; then
  echo "❌ tree→forest violations:"
  echo "$TREE_FOREST"
  ERRORS=$((ERRORS+1))
fi

# seed→tree/forest/land (forbidden — foundational)
SEED_UPPER=$(grep -rn "from ['\"]@/tree\|from ['\"]@/forest\|from ['\"]@/land" src/seed/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "quota-provider\.ts.*comment" || true)
if [ -n "$SEED_UPPER" ]; then
  echo "❌ seed→tree/forest/land violations:"
  echo "$SEED_UPPER"
  ERRORS=$((ERRORS+1))
fi

# land→forest (forbidden — circular)
LAND_FOREST=$(grep -rn "from ['\"]@/forest" src/land/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." || true)
if [ -n "$LAND_FOREST" ]; then
  echo "❌ land→forest violations:"
  echo "$LAND_FOREST"
  ERRORS=$((ERRORS+1))
fi

# Banned imports
BANNED=$(grep -rn "from ['\"]@/lib/auth\|from ['\"]@/lib/subscription\|from ['\"]@/lib/unified-tier-config\|from ['\"]@/lib/tier-gate" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ || true)
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

echo "✅ All layer boundaries clean"
