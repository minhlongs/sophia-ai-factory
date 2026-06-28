# Plan: Go-Live Readiness — 3 Features

**Created:** 2026-05-02
**Branch:** main
**Status:** In Progress

## Goal
Implement 3 independent admin-only features that boost go-live confidence without requiring real-money smoke tests.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 01 | [Circuit Breaker + Synthetic E2E + Ops Dashboard](phase-01-go-live-readiness.md) | In Progress |

## Key Files

### New
- `src/lib/fulfillment/circuit-breaker.ts` — HeyGen KV-backed circuit breaker
- `src/lib/admin/synthetic-fulfillment-runner.ts` — E2E proof runner helper
- `src/app/api/admin/run-synthetic-fulfillment/route.ts` — E2E proof endpoint
- `src/app/api/admin/circuit-breaker/reset/route.ts` — CB reset endpoint
- `src/app/api/admin/ops/snapshot/route.ts` — Ops snapshot API
- `src/app/[locale]/dashboard/admin/ops/page.tsx` — Ops dashboard page
- `src/app/[locale]/dashboard/admin/ops/ops-snapshot-card.tsx` — SWR client card

### Modified
- `src/lib/fulfillment/one-time-fulfillment.ts` — Add CB check + record
- `src/app/[locale]/dashboard/layout.tsx` — Add admin nav link

## Dependencies
- `requireAdmin` from `@/lib/auth/require-admin`
- `getKv()` pattern from `@/lib/signals/feature-flags`
- `isHeyGenHealthy()` from `@/lib/health/heygen-health-check`
- `cleanupSyntheticArtifacts` from `@/lib/monitoring/synthetic-cleanup`
