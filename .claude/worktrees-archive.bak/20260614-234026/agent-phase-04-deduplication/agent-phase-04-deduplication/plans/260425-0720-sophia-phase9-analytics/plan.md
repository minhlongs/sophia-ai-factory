---
title: "Sophia Phase 9 — Analytics Dashboard + Critical Fixes"
description: "Fix CI-blocking TS/test errors and ship Phase 9 founder-grade real-time analytics (cohort, churn, LTV, tier adoption)."
status: pending
priority: P1
effort: 32h
branch: main
tags: [analytics, phase9, bugfix, sse, cohort, churn, ltv]
created: 2026-04-25
---

# Sophia Phase 9 — Analytics Dashboard + Critical Fixes

## Goal
Unblock CI/CD (4 failing tests + 5 TS errors) AND deliver Phase 9 founder-grade analytics (real-time SSE, ARR/MRR, cohort retention, churn, LTV, tier adoption).

## Strategy
Two parallel tracks. Track A (bug fix) is independent — runs concurrently with foundational Track B work. Track B splits into 2 waves: foundation (SSE + revenue) then derived modules (cohort/churn/LTV + tier).

## Execution Graph
```
WAVE 1 (parallel, no file overlap):
├─ Phase 01 (Track A — bugfix)        [owner: bugfix-agent]
├─ Phase 02 (SSE realtime)            [owner: sse-agent]
└─ Phase 03 (Revenue ARR/MRR)         [owner: revenue-agent]
        ↓ all 3 must complete
WAVE 2 (parallel after Wave 1):
├─ Phase 04 (Cohort + Churn + LTV)    [owner: retention-agent]
└─ Phase 05 (Tier timeline + DatePicker)  [owner: tier-agent]
```

## Phases

| # | Phase | File | Wave | Owner | Effort |
|---|-------|------|------|-------|--------|
| 01 | Fix TS errors + failing tests | [phase-01-fix-ts-errors-and-failing-tests.md](./phase-01-fix-ts-errors-and-failing-tests.md) | 1 | bugfix | 4h |
| 02 | Real-time SSE analytics endpoint | [phase-02-analytics-realtime-sse.md](./phase-02-analytics-realtime-sse.md) | 1 | sse | 5h |
| 03 | Revenue ARR/MRR cards + types | [phase-03-analytics-revenue-metrics.md](./phase-03-analytics-revenue-metrics.md) | 1 | revenue | 5h |
| 04 | Cohort retention + churn + LTV | [phase-04-analytics-cohort-churn-ltv.md](./phase-04-analytics-cohort-churn-ltv.md) | 2 | retention | 10h |
| 05 | Tier adoption timeline + date picker | [phase-05-analytics-tier-adoption.md](./phase-05-analytics-tier-adoption.md) | 2 | tier | 8h |

## Key Dependencies
- Phase 04 reuses revenue types (Phase 03) for LTV calc → must wait for Phase 03
- Phase 05 modifies `dashboard/analytics/page.tsx` (also touched by Phase 01 TS fixes) → must wait for Phase 01
- Phase 04 + 05 do not overlap files → run parallel in Wave 2
- All Wave 1 phases own disjoint file sets → safe parallel

## Critical Constraints (from project rules)
- Next.js 16 + D1 (sync `createServerClient()` from `@/lib/db/client`)
- Better Auth (`getCurrentUser()` from `@/lib/better-auth-session`)
- Zero `:any` types — proper TS interfaces only
- NOWPayments (NOT Polar) for revenue source of truth
- Files under 200 lines — modularize aggressively
- Zod validation on all API inputs

## Success Criteria
- `npm run build` exits 0 (currently 5 TS errors)
- `npm test` 100% pass (currently 4 failing)
- 6 new analytics endpoints live (`/api/analytics/realtime`, `/cohorts`, plus reuse existing `/revenue`)
- Founder dashboard auto-refreshes every 30s via SSE
- Cohort heatmap + churn timeline + LTV calculator visible in admin
- Custom date range picker replaces preset windows

## Unresolved Questions (per research report)
1. Cohort backfill — use `users.created_at` or mark "unknown cohort"?
2. Churn KPI — count tier downgrade as churn? (Recommend: separate metric)
3. Date range API — accept ISO 8601 + Unix? (Recommend: both, normalize internally)
