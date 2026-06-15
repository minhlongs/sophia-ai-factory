# Phase 05 — Tier Adoption Timeline + Custom Date Range Picker

## Context Links
- Research: `plans/reports/researcher-analytics-phase9-assessment-240425.md` § E + A.2
- Depends on: [Phase 01](./phase-01-fix-ts-errors-and-failing-tests.md) (shares `dashboard/analytics/page.tsx`)
- Existing date picker: `src/components/analytics/date-range-picker.tsx` ⚠️ already exists — verify if Phase 05 enhances vs creates new
- Parent plan: [plan.md](./plan.md)

## Overview
- **Priority:** P1
- **Status:** Pending (blocked by Wave 1)
- **Wave:** 2 (parallel with Phase 04)
- **Effort:** ~8h
- **Owner:** tier-agent

Tier adoption stacked-area chart + enhanced custom date range picker + dashboard page integration (wires components from Phases 02/03/04).

## Key Insights
- Existing `date-range-picker.tsx` already present — task is to ENHANCE for ISO 8601 + Unix dual support, not duplicate
- Tier adoption uses `tier_change_events` table (created in Phase 04 if missing) + new signups query
- This phase is the integration point — wires SSE (Phase 02), RevenueCard (Phase 03), Cohort/Churn/LTV (Phase 04) into single dashboard page
- Replaces preset windows (24h/7d) with custom date range across ALL analytics views

## Requirements

### Functional
- New `<TierAdoptionChart />`: stacked area showing daily counts of BASIC/PREMIUM/ENTERPRISE/MASTER subscribers over 90d
- Enhanced `<DateRangePicker />`: accepts custom range (ISO + Unix dual), presets (7d/30d/90d/12m/custom)
- Integration: `dashboard/analytics/page.tsx` adds 5 sections — RealtimeStrip, RevenueCard, TierAdoptionChart, CohortChart, ChurnTimeline+LTV
- SSE EventSource client wired to Phase 02 endpoint with auto-reconnect
- All charts respect global date range from picker

### Non-Functional
- File sizes: each component < 200 lines; page.tsx may need split into sub-components
- Zero `:any`, no Polar refs
- Maintain tier-gating (BASIC users see limited view)
- Mobile-responsive (charts collapse to vertical stack)

## Architecture
```
dashboard/analytics/page.tsx
        │
        ├── <DateRangePicker /> (global state)
        ├── <RealtimeStrip /> ──── EventSource → /api/analytics/realtime (Phase 02)
        ├── <RevenueCard />  ─────── /api/analytics/revenue (Phase 03)
        ├── <TierAdoptionChart /> ── /api/analytics/tier-adoption (NEW helper, reuses cohort table)
        ├── <CohortRetentionChart /> /api/analytics/cohorts?metric=retention (Phase 04)
        ├── <ChurnTimeline />  ──── /api/analytics/cohorts?metric=churn (Phase 04)
        └── <LTVCalculator />  ──── /api/analytics/cohorts?metric=ltv (Phase 04)
```

## Related Code Files

### Modify
- `src/app/[locale]/dashboard/analytics/page.tsx` ⚠️ shared with Phase 01 (Phase 05 runs AFTER) — major integration rewrite
- `src/components/analytics/date-range-picker.tsx` — enhance to accept ISO 8601 + Unix dual format; add custom range mode
- `src/lib/analytics/queries.ts` — additive re-export for tier adoption helper

### Create
- `src/components/analytics/tier-adoption-chart.tsx` — Recharts stacked area
- `src/components/analytics/realtime-strip.tsx` — small SSE-driven live stats bar (top of page)
- `src/lib/analytics/queries/tier-adoption-query.ts` — D1 query for daily tier counts
- `src/app/api/analytics/tier-adoption/route.ts` — endpoint (admin-only)
- `src/hooks/use-realtime-analytics.ts` — EventSource wrapper hook (auto-reconnect, error handling)

### Delete
- None

## Implementation Steps

1. **Enhance `<DateRangePicker />`:**
   - Add `mode: 'preset' | 'custom'`, presets `7d|30d|90d|12m`, custom = two `<input type=date>` fields
   - Output normalized: `{ startUnix: number, endUnix: number, startISO: string, endISO: string }`
   - Persist in URL query params via `useSearchParams` for shareable links
2. **Create `tier-adoption-query.ts`:**
   - SQL: per-day counts of users per tier from `users` + `tier_change_events`
   - Returns `TierAdoptionTimeline = { points: [{ date, BASIC, PREMIUM, ENTERPRISE, MASTER }] }`
3. **Create `/api/analytics/tier-adoption/route.ts`:**
   - Zod: `z.object({ start: z.string(), end: z.string() })` (accept ISO or Unix-as-string)
   - Admin auth gate
4. **Create `<TierAdoptionChart />`:**
   - Recharts `<AreaChart>` with `<Area stackId="1">` per tier
   - Color: BASIC gray, PREMIUM blue, ENTERPRISE purple, MASTER gold
   - Legend + tooltip
5. **Create `useRealtimeAnalytics` hook:**
   - `new EventSource('/api/analytics/realtime?org_id=...')` on mount
   - State: `{ snapshot: RealtimeAnalyticsSnapshot | null, connected: boolean, error: Error | null }`
   - Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
   - Cleanup on unmount
6. **Create `<RealtimeStrip />`:**
   - Uses `useRealtimeAnalytics`
   - Renders: "Live: X active clients · $Y MRR · Z% error rate · last update Ns ago"
   - Pulse animation green dot when connected
7. **Rewrite `dashboard/analytics/page.tsx`:**
   - Server component: fetch initial snapshot for SSR
   - Pass to client wrapper that wires DateRangePicker → all child components
   - Layout: RealtimeStrip (sticky top) → grid of cards
   - Tier-gate: BASIC sees only RealtimeStrip + limited chart; PREMIUM+ sees all
   - Keep file < 200 lines by extracting `<AnalyticsDashboardClient />` to separate file if needed
8. **Re-export from `queries.ts`:** add `fetchTierAdoptionTimeline`
9. **Build verify:** `npm run build` (0 errors).
10. **Manual smoke test:** open `/dashboard/analytics`, verify SSE connects + charts load
11. **Commit:** `feat(analytics): tier adoption timeline + date range picker + dashboard integration`

## Todo List
- [ ] Enhance `<DateRangePicker />` (custom mode + URL state)
- [ ] Create `tier-adoption-query.ts` D1 helper
- [ ] Create `/api/analytics/tier-adoption/route.ts`
- [ ] Create `<TierAdoptionChart />` stacked area
- [ ] Create `useRealtimeAnalytics` hook (EventSource + reconnect)
- [ ] Create `<RealtimeStrip />` live stats bar
- [ ] Rewrite `dashboard/analytics/page.tsx` integration
- [ ] Tier-gating logic (BASIC vs PREMIUM+ views)
- [ ] Re-export from `queries.ts`
- [ ] Build green
- [ ] Manual smoke test SSE + charts

## Success Criteria
- Date range picker supports ISO 8601 + Unix; URL-shareable
- Tier adoption chart renders 4 stacked tiers
- Realtime strip auto-updates every 30s via SSE
- All Phase 02/03/04 components integrated into single dashboard page
- BASIC tier sees limited view; PREMIUM+ sees all
- Mobile-responsive (charts stack vertically <md breakpoint)
- Files < 200 lines, no `:any`
- Build green

## Risk Assessment
- **R1:** Existing `date-range-picker.tsx` may conflict with new requirements → READ first; enhance vs replace.
- **R2:** SSE EventSource may not work in some browsers → fallback to 30s polling if `EventSource === undefined`.
- **R3:** Page.tsx will exceed 200 lines after integration → MUST split into `analytics-dashboard-client.tsx` per project rules.
- **R4:** Phase 04 charts may not be ready when Phase 05 starts → Phase 05 starts AFTER Phase 04 completes per execution graph.

## Security Considerations
- Admin-only for tier adoption endpoint
- SSE connection uses session cookie (already authed)
- URL query params (date range) are public-safe (no PII)

## File Ownership (NO OVERLAP with Phase 04; ordered AFTER Phase 01)
Phase 05 owns:
- `src/components/analytics/tier-adoption-chart.tsx` (NEW)
- `src/components/analytics/realtime-strip.tsx` (NEW)
- `src/components/analytics/date-range-picker.tsx` (MODIFY)
- `src/lib/analytics/queries/tier-adoption-query.ts` (NEW)
- `src/app/api/analytics/tier-adoption/route.ts` (NEW)
- `src/hooks/use-realtime-analytics.ts` (NEW)
- `src/app/[locale]/dashboard/analytics/page.tsx` (MAJOR REWRITE) ⚠️ shared with Phase 01 — Phase 05 runs AFTER Phase 01 completes
- `src/app/[locale]/dashboard/analytics/components/analytics-dashboard-client.tsx` (NEW, if split needed)
- `src/lib/analytics/queries.ts` — additive re-export only

## Next Steps
After Phase 05 completes: deploy to staging, smoke test all 5 dashboard sections, run Lighthouse audit for performance, document in `docs/system-architecture.md` under Phase 9 section.
