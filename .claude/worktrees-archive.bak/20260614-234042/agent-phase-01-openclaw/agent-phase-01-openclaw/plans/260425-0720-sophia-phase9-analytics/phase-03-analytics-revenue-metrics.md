# Phase 03 — Revenue ARR/MRR Metrics + Card

## Context Links
- Research: `plans/reports/researcher-analytics-phase9-assessment-240425.md` § A.3 "Client revenue card"
- Existing route: `src/app/api/analytics/revenue/route.ts` (Polar.sh-based — must rewrite for NOWPayments)
- CLAUDE.md: "Polar.sh REJECTED this product — DO NOT use Polar for Sophia"
- Parent plan: [plan.md](./plan.md)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Wave:** 1 (parallel-safe)
- **Effort:** ~5h
- **Owner:** revenue-agent

Build NOWPayments-backed revenue API + ARR/MRR card component for founder + admin dashboards.

## Key Insights
- Existing `/api/analytics/revenue` queries Polar.sh — WRONG provider; must source from NOWPayments IPN events table
- ARR = MRR × 12 (ARPU × active subscribers); MRR Growth % = (MRR_now - MRR_prev30d) / MRR_prev30d
- Tier breakdown reuses `TIER_CONFIGS` from `@/config/tiers` (single source of truth)
- Card component must be tier-gate aware (only PREMIUM+ admins see revenue numbers)

## Requirements

### Functional
- New types in `src/types/analytics-revenue.ts`: `RevenueSnapshot`, `MRRBreakdown`, `ARRTrendPoint`
- Rewrite `/api/analytics/revenue` route to query NOWPayments table (NOT Polar)
- Returns: `{ arr, mrr, mrrGrowthPct, byTier: TierRevenue[], trend30d: ARRTrendPoint[] }`
- New component `<RevenueCard />`: 4 metrics + sparkline (Recharts)
- Date range filter: `?period=30d|90d|12m`

### Non-Functional
- File sizes: route.ts < 180 lines, revenue-card.tsx < 180 lines, types.ts < 100 lines
- Zod validation on `period` query param (enum)
- Tier-gated: customer sees only own org aggregates; admin sees all
- Reuse `formatCurrency` from `src/lib/analytics/formatters.ts`

## Architecture
```
NOWPayments IPN events table (D1)
        │
        ▼
src/lib/analytics/queries/revenue-nowpayments.ts (NEW helper)
        │
        ▼
/api/analytics/revenue (REWRITTEN: NOWPayments-backed)
        │
        ▼
<RevenueCard /> (NEW component) ──used by admin + founder pages
```

## Related Code Files

### Modify
- `src/app/api/analytics/revenue/route.ts` — REWRITE to use NOWPayments source
- `src/lib/analytics/queries.ts` — re-export new revenue helper
- `src/lib/analytics/types.ts` ⚠️ shared additive only with Phase 01/02 — add `RevenueSnapshot` if not in dedicated file

### Create
- `src/types/analytics-revenue.ts` — `RevenueSnapshot`, `MRRBreakdown`, `ARRTrendPoint`, `TierRevenueRow`
- `src/components/analytics/revenue-card.tsx` — 4-metric card + sparkline

### Delete
- None (keep route at same path; rewrite contents)

## Implementation Steps

1. **Define types in `src/types/analytics-revenue.ts`:**
   ```ts
   interface RevenueSnapshot {
     arr: number; mrr: number; mrrGrowthPct: number;
     byTier: TierRevenueRow[]; trend30d: ARRTrendPoint[];
     periodStart: string; periodEnd: string;
   }
   interface TierRevenueRow { tier: 'BASIC'|'PREMIUM'|'ENTERPRISE'|'MASTER'; customers: number; mrr: number; arr: number; }
   interface ARRTrendPoint { date: string; arr: number; mrr: number; }
   ```
2. **Create query helper `src/lib/analytics/queries/revenue-nowpayments.ts`:**
   - `fetchRevenueSnapshot(period: '30d'|'90d'|'12m', orgId?: string): Promise<RevenueSnapshot>`
   - SQL: aggregate confirmed NOWPayments IPN events grouped by tier + day
   - Use `createServerClient()` (sync) per project rule
3. **Rewrite `/api/analytics/revenue/route.ts`:**
   - Remove all Polar.sh references
   - Zod query: `z.object({ period: z.enum(['30d','90d','12m']).default('30d'), org_id: z.string().optional() })`
   - Auth: `getCurrentUser()`; admin gates `org_id` cross-tenant
   - Return `RevenueSnapshot`
4. **Create `<RevenueCard />` component:**
   - Props: `snapshot: RevenueSnapshot, loading?: boolean`
   - Layout: 4 stat tiles (ARR, MRR, MRR Growth %, Active Tiers) + Recharts `<AreaChart>` 30d trend
   - Tier breakdown: small table or pie below
   - Use Tailwind 4 + shadcn `<Card>` if present
5. **Re-export from `src/lib/analytics/queries.ts`:**
   ```ts
   export { fetchRevenueSnapshot } from './queries/revenue-nowpayments';
   ```
6. **Build verify:** `npm run build` (0 errors).
7. **Commit:** `feat(analytics): NOWPayments-backed revenue snapshot + ARR/MRR card`

## Todo List
- [ ] Create `src/types/analytics-revenue.ts`
- [ ] Create `src/lib/analytics/queries/revenue-nowpayments.ts`
- [ ] Rewrite `/api/analytics/revenue/route.ts` (NOWPayments source)
- [ ] Re-export from `queries.ts`
- [ ] Create `<RevenueCard />` component
- [ ] Add 30d Recharts sparkline
- [ ] Tier breakdown table
- [ ] Zod validation on period param
- [ ] Auth + RBAC gating
- [ ] Build green

## Success Criteria
- `GET /api/analytics/revenue?period=30d` returns valid `RevenueSnapshot`
- `<RevenueCard />` renders ARR/MRR/Growth%/Trend without crash
- Zero Polar.sh references in revenue path
- Files < 200 lines, no `:any`
- Customer sees own org only; admin sees all

## Risk Assessment
- **R1:** NOWPayments IPN table may not have tier metadata → join with `licenses` or `users.tier` snapshot at payment time.
- **R2:** Currency conversion (USDT vs USD) → assume 1:1 for MVP; add `currency` field for future.
- **R3:** Trend calculation may be slow on large datasets → add D1 index on `(created_at, status)` if missing; cap query to 12m window.

## Security Considerations
- RBAC enforced via `getCurrentUser()` + admin check
- No raw IPN payload exposed (only aggregates)
- Tier-gate: BASIC users get 403 on revenue route (per existing RBAC pattern)

## File Ownership (NO OVERLAP)
Phase 03 owns:
- `src/app/api/analytics/revenue/route.ts` (REWRITE)
- `src/components/analytics/revenue-card.tsx` (NEW)
- `src/types/analytics-revenue.ts` (NEW)
- `src/lib/analytics/queries/revenue-nowpayments.ts` (NEW)
- `src/lib/analytics/queries.ts` — additive re-export only ⚠️ no semantic conflict

## Next Steps
Phase 04 (LTV calc) consumes `RevenueSnapshot.byTier` for `LTV = ARPU_tier × avgLifetimeMonths_tier`. Phase 05 wires `<RevenueCard />` into dashboard page.
