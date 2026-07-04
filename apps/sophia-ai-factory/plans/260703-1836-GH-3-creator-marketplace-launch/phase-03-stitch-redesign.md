---
phase: 3
title: "Stitch Redesign"
status: pending
effort: "Medium (4-6h)"  /* reduced after red-team: 80% already exists */
priority: P1
dependencies: [1]
---

# Phase 3: Stitch Redesign

## Overview

Redesign the SOP marketplace listing page in the amber Stitch theme. **Key correction from red-team:** A full locale-aware marketplace already exists at `[locale]/dashboard/sop-marketplace/` with SopGrid, install flow, and community listings. This phase should share components with the existing marketplace, not build from scratch.

**Red-team fix notes:**
- The "9 Stitch-redesigned screens" reference was false — only `pricing-stitch-section.tsx` exists. Removed.
- Use existing `forest/components/sop/` directory (not new `marketplace/`)
- Align API field names: API returns `totalSales` not `installCount`
- Old `(app)/sop-marketplace` route is already blocked by middleware — safe to delete

## Context

Current marketplace:
- Old public route: `src/app/sop-marketplace/` (top-level, no locale, already dead via middleware)
- Existing dashboard marketplace: `src/app/[locale]/dashboard/sop-marketplace/page.tsx` (full, locale-aware)
- API: `src/app/api/sop-marketplace/route.ts` — returns `totalSales`, `name_en`, `category`, `price_cents`, etc.
- Old client: `src/app/sop-marketplace/marketplace-client.tsx` — has search/filter/sort + star ratings
- Stitch pattern from `src/forest/components/pricing/pricing-stitch-section.tsx`

## Architecture

```
Decision needed:
  Option A: Public marketplace shares components with dashboard marketplace
  Option B: Dashboard marketplace serves as public (with auth-gated install)
  Option C: Separate public page that delegates install flow to dashboard
  
Recommended: Option A — extract SopGrid + filter components into shared
forest/components/sop/, use in both public [locale]/sop-marketplace/ and
dashboard marketplace.
```

## Related Code Files

- **Create:** `src/forest/components/sop/marketplace-stitch-section.tsx` (NOT new marketplace/ dir)
- **Modify:** `src/app/[locale]/dashboard/sop-marketplace/page.tsx` (optional — use shared component)
- **Create:** `src/app/[locale]/sop-marketplace/page.tsx` (public locale-aware route)
- **Modify:** `src/app/api/sop-marketplace/route.ts` (ensure all needed fields returned)
- **Delete:** `src/app/sop-marketplace/` (old route, already dead via middleware)

## Implementation Steps

### 3.1 Audit existing dashboard marketplace

Read `src/app/[locale]/dashboard/sop-marketplace/page.tsx` and components to understand what can be shared.

### 3.2 Create shared MarketplaceStitchSection component

In `src/forest/components/sop/marketplace-stitch-section.tsx`:
- Amber theme following PricingStitchSection pattern
- Props: templates, categories, locale, translations, showInstallCta
- Card grid with: thumbnail, title, category badge, author, totalSales (not installCount), rating stars
- Search, category filter, sort (popular/rating/newest)
- Empty state: "No SOPs match your filters"
- Port star rating display from old `marketplace-client.tsx`

### 3.3 Create public marketplace route

Server component at `[locale]/sop-marketplace/page.tsx`:
- Fetches published SOPs from `/api/sop-marketplace`
- Renders MarketplaceStitchSection without auth requirement
- Uses `getTranslations('sop.marketplace')`
- Install CTA redirects to login (or dashboard marketplace with auth)

### 3.4 Delete old route

Remove `src/app/sop-marketplace/` — already unreachable via middleware (non-locale-prefixed path is redirected to /).

### 3.5 Add i18n keys

Add to `messages/en.json` and `messages/vi.json`:
- sop.marketplace.title, subtitle
- sop.marketplace.search
- sop.marketplace.allCategories
- sop.marketplace.sortPopular, sortRating, sortNewest
- sop.marketplace.noResults
- sop.marketplace.sales (use totalSales field name)
- sop.marketplace.by, rating

## Success Criteria

- [ ] Marketplace renders in amber Stitch theme at `[locale]/sop-marketplace/`
- [ ] Search, category filter, sort all work in new UI
- [ ] Star rating and totalSales shown on cards (matching actual API response)
- [ ] Responsive on mobile
- [ ] Empty state shown when no SOPs match filters
- [ ] Old route deleted cleanly
- [ ] All text bilingual (VI + EN)
- [ ] All existing tests pass

## Risk Assessment

- **Low:** UI redesign only. Existing API unchanged.
- **Low:** Old route already dead — no migration needed.
- **Low:** Using existing dashboard marketplace as reference ensures consistency.
