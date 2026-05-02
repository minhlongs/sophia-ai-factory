# Go-Live Zero-Bug Hardening Plan

**Date:** 2026-05-02  
**Status:** Completed  
**Completed:** 2026-05-02  
**Branch:** main  
**Production SHA:** 84ad25ea (verified via /api/version)  
**Cron Status:** FIRING LIVE (verified in cron_run_log at 15:27 UTC post-deploy)

## Goal
Close 4 confidence gaps before announcing One-Time bundle to real customers.

## Phases

| Phase | Feature | Priority | Status |
|-------|---------|----------|--------|
| A | Harden `verifyCronAuth` — remove x-cf-cron bypass | P0 Security | ✅ |
| C | HeyGen health check endpoint + pricing-page gate | P0 UX | ✅ |
| D | Error toast on checkout failure | P1 UX | ✅ |
| G | Polish `failed_permanent` state in /dashboard/orders | P2 UI | ✅ |

## Files Modified

- `src/lib/security/cron-auth.ts` — remove x-cf-cron bypass
- `src/lib/security/__tests__/cron-auth.test.ts` — add rejection tests
- `scripts/inject-scheduled-handler.mjs` — Bearer auth dispatch
- `scripts/set-cron-secret.sh` — NEW: operator setup script
- `src/app/api/health/heygen/route.ts` — NEW: health endpoint
- `src/app/[locale]/pricing/page.tsx` — gate OneTimeBundleCard
- `src/components/pricing/one-time-bundle-card.tsx` — heygenHealthy prop + error toast
- `src/app/[locale]/dashboard/orders/order-card.tsx` — failed_permanent UI

## Deployment Status

**Build:** ✓ 0 TS errors  
**Tests:** ✓ 2240 pass (+35 from baseline)  
**Git Commits:** d3749e43, d0a0cfea, 7e8af97d, fa4c0ffe  
**Cron Verification:** fulfillment-retry count incremented 2→3 at 15:27 UTC (handler confirmed firing in production)

## Critical: Mid-Cook Fix Documented

**Issue discovered during D implementation:** scheduled() handler in `scripts/inject-scheduled-handler.mjs` was exported as named export → CloudflareWorkers didn't recognize it as entry point → cron never fired.  
**Fix applied:** Wrapped handler as method on default export. After re-deploy at 15:26 UTC, cron fired within 1 minute (15:27 UTC) — CONFIRMED in cron_run_log.

## Operator Action Completed

✓ `bash apps/sophia-ai-factory/scripts/set-cron-secret.sh` already executed (CRON_SECRET loaded in Cloudflare env)  
✓ Deploy completed 2026-05-02 15:26 UTC  
✓ Cron firing verified live post-deploy

## Deferred Work (B/E/F/H + I — Manual User Steps)

See `plans/reports/user-runbook-260502-0756-go-live.md` for non-blocking manual actions.  
Alert pipeline (I) deferred to live smoke phase.

## Detailed Phase
See `phase-01-go-live-zero-bug.md` for full implementation detail.
