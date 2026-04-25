# Phase 04 — Cohort Retention + Churn + LTV

## Context Links
- Research: `plans/reports/researcher-analytics-phase9-assessment-240425.md` § B/C/D
- Depends on: [Phase 03](./phase-03-analytics-revenue-metrics.md) (RevenueSnapshot.byTier for LTV)
- Parent plan: [plan.md](./plan.md)

## Overview
- **Priority:** P1
- **Status:** Pending (blocked by Wave 1)
- **Wave:** 2 (parallel with Phase 05)
- **Effort:** ~10h
- **Owner:** retention-agent

Three retention modules: cohort heatmap, churn timeline, LTV calculator. Single shared API endpoint for cohorts; LTV computes client-side from revenue + cohort data.

## Key Insights
- Existing `users` table likely has `created_at` → use as cohort_month source (per research § Unresolved Q2)
- D1 cohort query: bucket users by signup month, count "active" (had usage event in month N after signup)
- Churn = subscription cancellation event OR no usage for 30+ days (define both, surface both)
- LTV formula: `LTV = ARPU_tier × avgLifetimeMonths_tier`; ARPU from Phase 03, lifetime from cohort retention curve
- Tier downgrade tracked separately from churn (per research § Q4 recommendation)

## Requirements

### Functional
- New endpoint `GET /api/analytics/cohorts?metric=retention|churn|ltv&tier=...&months=12`
- Returns one of:
  - `CohortRetentionMatrix`: `{ cohorts: [{ month, signupCount, retention: number[] }] }`
  - `ChurnTimeline`: `{ points: [{ date, churnedCount, downgradedCount, churnRate }] }`
  - `LTVByTier`: `{ tiers: [{ tier, arpu, avgLifetimeMonths, ltv, ltvCacRatio? }] }`
- Three new components consuming this endpoint
- Admin-only RBAC

### Non-Functional
- Each component file < 200 lines
- Single endpoint with metric switch (DRY) but split query helpers per metric
- Zod validation on metric/tier/months
- Heavy queries cached 5min via `Cache-Control: private, max-age=300`

## Architecture
```
/api/analytics/cohorts?metric=retention → cohort-retention-query.ts
/api/analytics/cohorts?metric=churn     → churn-query.ts
/api/analytics/cohorts?metric=ltv       → ltv-calculator.ts (combines retention + RevenueSnapshot)
                                                    │
                                                    ▼
                          <CohortRetentionChart /> | <ChurnTimeline /> | <LTVCalculator />
```

## Related Code Files

### Modify
- `src/lib/analytics/queries.ts` — re-export new helpers (additive)

### Create
- `src/app/api/analytics/cohorts/route.ts` — single endpoint, metric switch
- `src/lib/analytics/queries/cohort-retention-query.ts` — D1 cohort matrix builder
- `src/lib/analytics/queries/churn-query.ts` — churn + downgrade timeline
- `src/lib/analytics/queries/ltv-calculator.ts` — combines retention + revenue
- `src/components/analytics/cohort-retention-chart.tsx` — heatmap (Recharts custom or table fallback)
- `src/components/analytics/churn-timeline.tsx` — line chart with churned + downgraded series
- `src/components/analytics/ltv-calculator.tsx` — table: tier × ARPU × lifetime × LTV

### Delete
- None

## Implementation Steps

1. **D1 schema check:** Verify `users.created_at`, `subscriptions.cancelled_at`, `tier_change_events` (or equivalent). If `tier_change_events` missing → create migration `001X-tier-change-events.sql` (additive, non-breaking).
2. **Cohort retention query (`cohort-retention-query.ts`):**
   - Group `users` by `strftime('%Y-%m', created_at)` cohort_month
   - For each cohort, for each subsequent month N (0..11), count distinct users who have usage_events.created_at within month N+cohort
   - Return `CohortRetentionMatrix`
3. **Churn query (`churn-query.ts`):**
   - Daily timeline last 90d
   - Churned = subscription.cancelled_at OR no usage_event in last 30d
   - Downgraded = tier_change_events where new_tier_rank < old_tier_rank
   - Compute `churnRate = churnedCount / activeAtPeriodStart`
4. **LTV calculator (`ltv-calculator.ts`):**
   - Import `fetchRevenueSnapshot` from Phase 03
   - Import `fetchCohortRetention` from step 2
   - Per tier: `arpu = tier.mrr / tier.customers`; `avgLifetimeMonths` from retention curve area
   - `ltv = arpu × avgLifetimeMonths`
5. **Endpoint `/api/analytics/cohorts/route.ts`:**
   - Zod: `z.object({ metric: z.enum(['retention','churn','ltv']), tier: z.string().optional(), months: z.coerce.number().min(1).max(24).default(12) })`
   - Auth: admin only (403 for non-admin)
   - Switch on metric → call appropriate helper
6. **`<CohortRetentionChart />`:**
   - Render as colored grid (cohort row × month col), color intensity = retention %
   - Use Tailwind bg-color scale (`bg-green-100` to `bg-green-900`)
   - Tooltip: cohort signups + month + retention %
7. **`<ChurnTimeline />`:**
   - Recharts `<LineChart>` with two series: churned, downgraded
   - Tooltip: counts + rate %
8. **`<LTVCalculator />`:**
   - Table: rows = tiers, cols = ARPU / Lifetime / LTV
   - Optional: input field for CAC → compute LTV:CAC ratio
9. **Re-export from `queries.ts`:** add `fetchCohortRetention`, `fetchChurnTimeline`, `calculateLTV`
10. **Build verify:** `npm run build` (0 errors).
11. **Commit:** `feat(analytics): cohort retention + churn timeline + LTV calculator`

## Todo List
- [ ] Verify D1 schema (users, subscriptions, tier_change_events)
- [ ] Add migration if `tier_change_events` missing
- [ ] Create `cohort-retention-query.ts`
- [ ] Create `churn-query.ts`
- [ ] Create `ltv-calculator.ts`
- [ ] Create `/api/analytics/cohorts/route.ts` with metric switch
- [ ] Zod validation
- [ ] Admin RBAC
- [ ] Create `<CohortRetentionChart />` heatmap
- [ ] Create `<ChurnTimeline />`
- [ ] Create `<LTVCalculator />` with optional CAC input
- [ ] Re-export from `queries.ts`
- [ ] Build green

## Success Criteria
- `GET /api/analytics/cohorts?metric=retention` returns matrix
- `GET /api/analytics/cohorts?metric=churn` returns timeline
- `GET /api/analytics/cohorts?metric=ltv` returns per-tier LTV
- All 3 components render without crash
- 403 for non-admin, 401 for unauth
- Files < 200 lines, no `:any`

## Risk Assessment
- **R1:** Cohort backfill — pre-April 2026 users may have unreliable `created_at` → mark cohort `unknown` if NULL (per research Q2).
- **R2:** "Active" definition ambiguous → use "had ≥1 usage_event in window" as MVP definition; document.
- **R3:** LTV depends on Phase 03 revenue helper — block Phase 04 start until Phase 03 complete.
- **R4:** Heatmap on small screens looks cramped → horizontal scroll wrapper.

## Security Considerations
- Admin-only — sensitive financial data
- No raw user emails in cohort data; only counts
- Cache-Control private to prevent CDN leakage

## File Ownership (NO OVERLAP with Phase 05)
Phase 04 owns:
- `src/app/api/analytics/cohorts/route.ts` (NEW)
- `src/components/analytics/cohort-retention-chart.tsx` (NEW)
- `src/components/analytics/churn-timeline.tsx` (NEW)
- `src/components/analytics/ltv-calculator.tsx` (NEW)
- `src/lib/analytics/queries/cohort-retention-query.ts` (NEW)
- `src/lib/analytics/queries/churn-query.ts` (NEW)
- `src/lib/analytics/queries/ltv-calculator.ts` (NEW)
- `src/lib/analytics/queries.ts` — additive re-export only ⚠️ shared with Phase 03 (additive merge)
- New migration file `migrations/001X-tier-change-events.sql` (if needed)

## Next Steps
Phase 05 wires these 3 components into `dashboard/analytics/page.tsx` alongside tier adoption + date picker.
