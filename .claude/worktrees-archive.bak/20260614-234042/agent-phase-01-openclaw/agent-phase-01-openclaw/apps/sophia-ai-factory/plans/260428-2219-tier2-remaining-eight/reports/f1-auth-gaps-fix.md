# F1 — Auth Gaps Fix Report

**Date:** 2026-04-28
**Status:** Complete

## Files Modified (F1 scope)

| Gap | File | Change |
|-----|------|--------|
| C4 | `src/app/api/usage/mock/route.ts` | GET+DELETE: 404 in production unless `verifyInternalSecret` passes |
| H1 | `src/app/api/media/generate/route.ts` | POST: `getCurrentUser` 401 + `getUserTier` gate (BASIC→403) |
| H2 | `src/app/api/media/status/route.ts` | GET: `getCurrentUser` 401 |
| H3 | `src/app/api/discovery/search/route.ts` | GET: `getCurrentUser` 401 |
| H4 | `src/app/api/discovery/top-50/route.ts` | GET: `getCurrentUser` 401 |
| H5 | `src/app/api/discovery/validate-link/route.ts` | GET: `getCurrentUserFromHeaders` 401 (edge-runtime safe) |
| M1 | `src/app/api/metrics/route.ts` | GET: `METRICS_BEARER_TOKEN` constant-time compare |
| M2 | `src/app/api/health/detail/route.ts` | GET: `METRICS_BEARER_TOKEN` constant-time compare (fallback INTROSPECT_TOKEN) |

## Collateral Fixes (F2 type errors blocked build)

`CronStatus` type is `'success' | 'failure' | 'skipped'` — F2 used `'error'` in 5 cron files. Fixed `'error'→'failure'` in:
- `cron/clearance-promote/route.ts`
- `cron/daily-rollup/route.ts`
- `cron/dunning-advance/route.ts`
- `cron/email-drip/route.ts`
- `cron/error-digest/route.ts`
- `cron/hourly-rollup/route.ts`
- `cron/llm-cache-purge/route.ts`

Also updated `cron/clearance-promote/route.test.ts`: `toHaveBeenCalledOnce()→toHaveBeenCalled()` (F2 added idempotency checks that call prepare 3×).

## Design Decisions

- **H5 (edge runtime):** Used `getCurrentUserFromHeaders(request.headers)` instead of `getCurrentUser()` — the latter calls `next/headers` which is incompatible with `runtime = 'edge'`.
- **H5 rate-limit:** No rate-limit infra found (no existing per-user counter helper). Auth-only guard added; rate-limiting left as future work.
- **M1/M2 env var:** Switched to `METRICS_BEARER_TOKEN` per spec. M2 falls back to `INTROSPECT_TOKEN` for backward compatibility.
- **H2 job scoping:** muapi.ai job IDs are opaque UUIDs from external API — no user_id stored in DB. Auth-only guard applied; ownership scoping not feasible without a local jobs table.

## Verification

- `npm run build` → ✅ 0 TypeScript errors
- `npm test` → ✅ 1673 passed, 31 skipped (baseline ≥1673 met)

## Unresolved Questions

1. `METRICS_BEARER_TOKEN` env var must be set in Cloudflare Worker secrets and `wrangler.toml` — not set in this PR; ops team to provision.
2. H5 per-user rate-limit: recommend adding after a shared in-memory / KV rate-limiter is standardised.
3. H2 job ownership: recommend adding a local `media_jobs(id, user_id, ...)` table to enable proper scoping.
