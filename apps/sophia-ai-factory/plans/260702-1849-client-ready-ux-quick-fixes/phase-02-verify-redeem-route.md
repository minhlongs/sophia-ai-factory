---
phase: 2
title: "Verify Redeem Route"
status: pending
effort: "~15 min"
priority: P2
---

# Phase 2: Verify Redeem Route

## Overview

Hero has a "Redeem" CTA button linking to `/redeem`. Verify the route exists, works correctly, or fix if missing.

## Requirements

- Check if `src/app/[locale]/redeem/page.tsx` exists
- If missing: create a proper redeem page or redirect to `/login?tab=signup&coupon=...`
- If existing: verify it renders correctly

## Related Code Files

- Check: `src/app/[locale]/redeem/` (route exists?)
- Modify: `src/app/components/sections/hero.tsx` (fix href if needed)

## Implementation Steps

1. Check if route exists: `ls src/app/[locale]/redeem/page.tsx`
2. If exists: verify imports, test build
3. If not: create redirect page (similar to /signup pattern) or remove button from hero

## Success Criteria

- [ ] `/redeem` route works (either renders or redirects)
- [ ] Build passes
