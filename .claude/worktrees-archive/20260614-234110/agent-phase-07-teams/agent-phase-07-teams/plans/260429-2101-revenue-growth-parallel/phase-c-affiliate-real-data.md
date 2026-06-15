# Phase C — Affiliate Dashboard Real Data Wiring

**Owner:** fullstack-developer (affiliate)
**File ownership:** `src/app/[locale]/affiliate-discovery/**`, `src/app/api/affiliate-discovery/**`

## Goals

1. Replace `DEMO_PRODUCTS` hardcoded array in `affiliate-discovery/page.tsx` with real D1 query
2. Create API route `src/app/api/affiliate-discovery/route.ts` returning paginated offers from `affiliate_offers_selected`
3. Server-side render real data on initial page load (no client fetch initially)
4. Empty-state UI when no rows
5. Add Vitest test for API route

## Current State (scout findings)

- Page exists with 6 hardcoded DEMO products
- D1 migrations exist: `0021-affiliate-offers-selected.sql` + `0022-affiliate-conversions.sql`
- No `/api/affiliate-discovery` route yet
- Page uses violet+cyan gradient design

## Implementation Steps

1. Read `migrations/0021-affiliate-offers-selected.sql` to understand schema
2. Create `src/app/api/affiliate-discovery/route.ts`:
   - GET handler returns `{ offers: [...], total: N }` from D1
   - Limit 50, support `?page=N` query param
   - Use `createServerClient()` from `@/lib/db/client`
   - Zod validation on query params
3. Refactor `src/app/[locale]/affiliate-discovery/page.tsx`:
   - Server component fetches initial data via `createServerClient()` directly (faster, 1 round-trip)
   - Map fields to existing card markup
   - Show empty-state ("No offers yet — check back soon") if 0 rows
   - Keep gradient design intact
4. Create `src/app/api/affiliate-discovery/route.test.ts`:
   - Mock D1 client
   - Test empty result, populated result, pagination

## File Ownership (do NOT touch outside)

- ✅ `src/app/[locale]/affiliate-discovery/page.tsx` (refactor for real data)
- ✅ `src/app/[locale]/affiliate-discovery/error.tsx` (read-only)
- ✅ `src/app/api/affiliate-discovery/route.ts` (NEW)
- ✅ `src/app/api/affiliate-discovery/route.test.ts` (NEW)
- ❌ DO NOT touch migrations (Phase A/B may collide)
- ❌ DO NOT add D1 indexes outside this scope

## Success Criteria

- [ ] route.test.ts passes (≥3 tests)
- [ ] /affiliate-discovery returns 200 and renders cards from real D1 data
- [ ] If D1 table empty → empty-state shown (not error)
- [ ] No new TS errors
- [ ] No `:any` types

## Reports

Save report to `/Users/macbook/sophia-ai-factory/plans/260429-2101-revenue-growth-parallel/reports/fullstack-developer-affiliate-260429-2101.md`
