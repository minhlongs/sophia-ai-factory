# Go-Live Zero-Bug Hardening Plan

**Date:** 2026-05-02  
**Status:** In Progress  
**Branch:** main

## Goal
Close 4 confidence gaps before announcing One-Time bundle to real customers.

## Phases

| Phase | Feature | Priority | Status |
|-------|---------|----------|--------|
| A | Harden `verifyCronAuth` — remove x-cf-cron bypass | P0 Security | [ ] |
| C | HeyGen health check endpoint + pricing-page gate | P0 UX | [ ] |
| D | Error toast on checkout failure | P1 UX | [ ] |
| G | Polish `failed_permanent` state in /dashboard/orders | P2 UI | [ ] |

## Files Modified

- `src/lib/security/cron-auth.ts` — remove x-cf-cron bypass
- `src/lib/security/__tests__/cron-auth.test.ts` — add rejection tests
- `scripts/inject-scheduled-handler.mjs` — Bearer auth dispatch
- `scripts/set-cron-secret.sh` — NEW: operator setup script
- `src/app/api/health/heygen/route.ts` — NEW: health endpoint
- `src/app/[locale]/pricing/page.tsx` — gate OneTimeBundleCard
- `src/components/pricing/one-time-bundle-card.tsx` — heygenHealthy prop + error toast
- `src/app/[locale]/dashboard/orders/order-card.tsx` — failed_permanent UI

## Critical: Operator Action Required Before Deploy
Run `bash apps/sophia-ai-factory/scripts/set-cron-secret.sh` ONCE before next deploy.
Otherwise all scheduled crons will 401 and stop firing.

## Detailed Phase
See `phase-01-go-live-zero-bug.md` for full implementation detail.
