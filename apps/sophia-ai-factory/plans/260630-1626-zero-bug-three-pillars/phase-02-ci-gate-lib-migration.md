# Phase 02 — CI Boundary Gate + src/lib Migration

**Pillar:** A — Hard Boundary Enforcement
**Status:** completed
**Priority:** P1
**Wave:** 2 (depends on Phase 01)

## Context Links
- Parent: `plans/260630-1626-zero-bug-three-pillars/plan.md`
- Phase 01: `phase-01-fix-boundary-violations.md`

## Overview

Sau khi fix hết violations, cài CI gate để ngăn tái phạm + migrate 3 files còn lại trong `src/lib/`.

## 1. CI Boundary Gate Script

Tạo `scripts/check-layer-boundaries.sh`:
```bash
#!/bin/bash
# Exit 1 if any layer boundary violation found
ERRORS=0

echo "=== Checking tree→land violations ==="
TREE_LAND=$(grep -rn "from ['\"]@/land" src/tree/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "index\.ts:.*barrel.*allowed")
if [ -n "$TREE_LAND" ]; then
  echo "❌ tree→land violations:"
  echo "$TREE_LAND"
  ERRORS=$((ERRORS+1))
fi

echo "=== Checking tree→forest violations ==="
TREE_FOREST=$(grep -rn "from ['\"]@/forest" src/tree/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\.")
if [ -n "$TREE_FOREST" ]; then
  echo "❌ tree→forest violations:"
  echo "$TREE_FOREST"
  ERRORS=$((ERRORS+1))
fi

echo "=== Checking seed→upper violations ==="
SEED_UPPER=$(grep -rn "from ['\"]@/tree\|from ['\"]@/forest\|from ['\"]@/land" src/seed/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "quota-provider\.ts.*comment")
if [ -n "$SEED_UPPER" ]; then
  echo "❌ seed→tree/forest/land violations:"
  echo "$SEED_UPPER"
  ERRORS=$((ERRORS+1))
fi

echo "=== Checking land→forest violations ==="
LAND_FOREST=$(grep -rn "from ['\"]@/forest" src/land/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "\.test\." | grep -v "deprecated")
if [ -n "$LAND_FOREST" ]; then
  echo "❌ land→forest violations:"
  echo "$LAND_FOREST"
  ERRORS=$((ERRORS+1))
fi

if [ $ERRORS -gt 0 ]; then
  echo "❌ $ERRORS boundary violation categories found. Fix before commit."
  exit 1
fi
echo "✅ All layer boundaries clean"
```

Add to `package.json`:
```json
"check-boundaries": "bash scripts/check-layer-boundaries.sh"
```

Add to `npm run ci` pipeline.

## 2. .pre-commit-hook Integration

Add to `.husky/pre-commit`:
```bash
npm run check-boundaries || exit 1
```

## 3. src/lib/ Migration

3 files còn lại:

| File | Destination | Reason |
|------|-------------|--------|
| `src/lib/redis-stub.ts` | `src/seed/db/redis-stub.ts` | DB-related primitive |
| `src/lib/utils.ts` | `src/seed/utils/lib-utils.ts` | Utility functions |
| `src/lib/admin/supabase-migrations-manifest.ts` | `src/tree/admin/supabase-migrations-manifest.ts` | Domain-specific admin |

Update all imports referencing `@/lib/*` → new paths.

## Success Criteria
- [ ] `bash scripts/check-layer-boundaries.sh` exits 0
- [ ] Script integrated in `npm run ci`
- [ ] `src/lib/` directory empty (or only has README explaining migration)
- [ ] 0 imports from `@/lib/*` in entire codebase
- [ ] `npm run build` → 0 errors
- [ ] `npm test` → all pass
