## Phase Implementation Report — Phase C: Affiliate Real Data

### Executed Phase
- Phase: phase-c-affiliate-real-data
- Plan: plans/260429-2101-revenue-growth-parallel/
- Status: completed

---

### Schema Snippet (0021-affiliate-offers-selected.sql)

```sql
CREATE TABLE IF NOT EXISTS affiliate_offers_selected (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  offer_id TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  affiliate_link TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL DEFAULT 'clickbank'
    CHECK (network IN ('clickbank','shareasale','amazon','manual')),
  commission_rate REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Columns surfaced to API: `id, offer_name, network, commission_rate, created_at`.
No `score` or `trend` columns in schema — DEMO_PRODUCTS assumptions dropped.

---

### Files Modified

| File | Status | Lines |
|------|--------|-------|
| `src/app/api/affiliate-discovery/route.ts` | NEW | 72 |
| `src/app/api/affiliate-discovery/route.test.ts` | NEW | 105 |
| `src/app/[locale]/affiliate-discovery/page.tsx` | REFACTORED | 96 |

---

### Tasks Completed

- [x] Read schema — confirmed columns (no score/trend fields)
- [x] Created `route.ts` — GET handler, Zod validation, createServerClient() (sync), withRateLimit 60 req/min
- [x] Refactored `page.tsx` — async server component, real D1 fetch, empty-state UI, violet+cyan gradient preserved
- [x] Removed all DEMO_PRODUCTS code
- [x] Created `route.test.ts` — 5 tests (empty result, populated, pagination offset, limit>100 → 400, page=0 → 400)

---

### Tests Status
- Type check: pass — 0 errors
- Unit tests: 5/5 passed (vitest)

---

### Page Render Behavior

- **D1 has rows**: server fetches first 50 ordered by `created_at DESC`, renders card grid with offer_name, network, commission_rate
- **D1 empty**: empty-state shown — "Chưa có sản phẩm nào / No offers yet — check back soon" + CTA to /pricing
- **D1 throws**: `fetchOffers()` catches and returns `[]`, page renders empty-state (no error page)
- Gradient preserved: violet-400→cyan-400 heading, violet-600→cyan-600 CTA button

---

### Unresolved Questions

1. Schema has no `score` or `trend` columns — DEMO_PRODUCTS had those fields. Card now shows `network` badge instead of score. If a score column is added later, page.tsx needs updating.
2. `commission_rate` is stored as REAL (0–1 range assumed, e.g. 0.3 = 30%). Formatted as `Math.round(rate * 100)%`. Confirm this matches how data is inserted.
3. Table is scoped to `campaign_id + user_id` rows — public discovery page shows ALL rows regardless of user. Confirm this is intended (not filtered by current user session).
