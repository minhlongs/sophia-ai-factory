# Bundle Size Optimization Report

**Date:** 2026-03-10 12:20 PM
**Task:** Optimize bundle size
**Mode:** --auto
**Status:** ⚠️ Partial Complete

---

## Implemented Optimizations ✅

### 1. Compiler Optimization

```typescript
// next.config.ts
compiler: {
  removeConsole: process.env.NODE_ENV === "production"
}
```

**Impact:** Removes all `console.log` statements from production build

---

### 2. Scripts

```json
{
  "analyze": "ANALYZE=true npm run build"
}
```

**Usage:** Run `pnpm analyze` to see bundle breakdown

**Note:** Bundle analyzer requires `@next/bundle-analyzer` package (blocked by workspace dependency issue)

---

## Attempted (Reverted Due to Build Issues) ❌

### 1. Webpack/Turbopack Custom Config

```typescript
// Reverted - caused SIGTERM build failures
webpack: (config) => {
  config.optimization = {
    usedExports: true,  // Tree shaking
    minimize: true,
  };
}
```

**Reason Reverted:** Turbopack build worker SIGTERM failures

---

### 2. Lazy Loading Components

```typescript
// Reverted - caused TypeScript compilation timeout
const Features = lazy(() => import('./components/sections/Features'));
```

**Reason Reverted:** Build timeout with Turbopack + lazy loading

---

## Current Bundle Status

| Metric | Value |
|--------|-------|
| Build Time | ~5.0s |
| Pages | 1 (static) |
| Route | `/` |
| Output | Static (SSG) |

---

## Recommendations (When Workspace Fixed)

### 1. Install Bundle Analyzer

```bash
pnpm add -D @next/bundle-analyzer webpack-bundle-analyzer
```

Then run:
```bash
pnpm analyze
```

### 2. Tree Shaking Opportunities

**Current dependencies:**
- `framer-motion` (12MB) - Consider `framer-motion/dom` for smaller bundle
- `lucide-react` (icons) - Import individual icons only

```typescript
// Instead of:
import { Check, X, Star } from 'lucide-react';

// Use:
import Check from 'lucide-react/icons/check';
```

### 3. Lazy Loading Strategy

When Turbopack supports better:

```typescript
// Lazy load below-fold sections
const Pricing = lazy(() => import('./components/sections/Pricing'));
const FAQ = lazy(() => import('./components/sections/FAQ'));
```

### 4. Image Optimization

```typescript
// next.config.ts
images: {
  unoptimized: false,
  formats: ['image/webp', 'image/avif'],
}
```

### 5. Tailwind CSS Purge

Already enabled by default in Tailwind v4 - only used classes included.

---

## Summary

| Optimization | Status | Notes |
|--------------|--------|-------|
| removeConsole | ✅ Done | Production only |
| Bundle Analyzer | ⏳ Pending | Workspace block |
| Tree Shaking | ⏳ Pending | Turbopack default |
| Lazy Loading | ❌ Reverted | Build timeout |
| Image Optimization | ⏳ TODO | Add next.config |
| Icon Tree Shaking | ⏳ TODO | Import individual |

---

## Next Steps

1. **Fix workspace dependency** - `packages/i18n` missing `@agencyos/shared`
2. **Install bundle analyzer** - `pnpm add -D @next/bundle-analyzer`
3. **Run analyze** - Identify largest bundles
4. **Optimize icons** - Import individual Lucide icons
5. **Consider framer-motion/dom** - Smaller animation library

---

## Unresolved Questions

None - Optimization limited by workspace/tooling issues.
