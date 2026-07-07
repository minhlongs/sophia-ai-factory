---
phase: 4
title: "SEO + Analytics"
status: completed
effort: "Small (1-2h)"
priority: P1
dependencies: [3]
---

# Phase 4: SEO + Analytics

## Overview

Add SEO metadata and analytics to the marketplace. **Correction from red-team:** The old `marketplace-client.tsx` already renders star ratings (`stars()`) and displays `installCount` (rename to `totalSales`). The new Stitch component should port this, not rebuild from scratch.

**Red-team fix note:** API returns `totalSales`, not `installCount`. Use the actual field name from `src/app/api/sop-marketplace/route.ts`.

## Context

- Marketplace API returns: `totalSales`, `ratingAvg`, `ratingCount`, `name_en`, `category`, `price_cents`
- Old client at `src/app/sop-marketplace/marketplace-client.tsx` already renders stars + sales/installs
- Stitch component (from Phase 3) will port these
- No per-category SEO titles/descriptions currently

## Related Code Files

- **Modify:** `src/forest/components/sop/marketplace-stitch-section.tsx` (from Phase 3) — show totalSales + rating
- **Modify:** `src/app/[locale]/sop-marketplace/page.tsx` (from Phase 3) — add per-category metadata
- **Read:** `src/app/api/sop-marketplace/route.ts` — verify response schema

## Implementation Steps

### 4.1 Port existing rating/sales display

From old `marketplace-client.tsx`, port:
- `stars()` function for star rating display
- `{t.ratingAvg.toFixed(1)}` rating number
- `{t.totalSales} sales` (use `totalSales` not `installCount`)

### 4.2 Add per-category SEO metadata

In the server component, per-category `generateMetadata`:

```typescript
export async function generateMetadata({ searchParams }): Promise<Metadata> {
  const category = (await searchParams)?.category;
  const t = await getTranslations('sop.marketplace.seo');
  return {
    title: category
      ? `SOP Marketplace: ${category} Templates | Sophia AI Factory`
      : 'SOP Marketplace | Sophia AI Factory',
  };
}
```

### 4.3 Add JSON-LD structured data

Add Product schema markup for SOP templates in the page head.

## Success Criteria

- [ ] Each marketplace category has unique SEO title
- [ ] Total sales count shown on SOP cards (using `totalSales` API field)
- [ ] Star rating shown on SOP cards (ported from old client)
- [ ] All existing tests pass

## Risk Assessment

- **Low:** Only adds data display + metadata. No logic changes.
