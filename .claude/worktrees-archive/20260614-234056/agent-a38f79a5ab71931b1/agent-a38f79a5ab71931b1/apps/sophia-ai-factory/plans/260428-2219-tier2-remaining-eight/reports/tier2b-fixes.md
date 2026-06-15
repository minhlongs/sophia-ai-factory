# TIER-2B Fix Report — Lock down 5 critical routes

**Date:** 2026-04-28
**Status:** Complete

## Files Created

| File | LOC | Purpose |
|---|---|---|
| `src/lib/security/verify-internal-secret.ts` | 38 | Shared constant-time `verifyInternalSecret(req)` using `INTERNAL_API_SECRET` |

## Files Modified

| File | Change |
|---|---|
| `src/app/api/debug/migrate/route.ts` | 404 in production + `verifyInternalSecret` check |
| `src/app/api/debug/db-schema/route.ts` | 404 in production + `verifyInternalSecret` check |
| `src/app/api/usage/debug/route.ts` | `getCurrentUser` + `role === 'admin'` gate |
| `src/app/api/graphql/analytics/route.ts` | `getCurrentUser` + `role === 'admin'` on POST and GET |
| `src/app/api/internal/usage/query/route.ts` | Replaced `validateInternalSecret` (local, used `INTERNAL_WEBHOOK_SECRET`) with `verifyInternalSecret` (shared, uses `INTERNAL_API_SECRET`) |
| `src/app/api/license/sync/route.ts` | `verifyInternalSecret` check before parsing body |
| `src/app/api/usage/reconciliation/sync/route.ts` | `verifyInternalSecret` on GET and POST |
| `src/app/api/internal/usage/query/internal-usage-query.test.ts` | Updated env stubs from `INTERNAL_WEBHOOK_SECRET` → `INTERNAL_API_SECRET` to match new helper |

## Security Pattern Applied

- **Debug routes** (`/api/debug/*`): NODE_ENV production guard → 404, then `x-internal-secret` gate in dev/test
- **User-data debug** (`/api/usage/debug`): session auth + `role === 'admin'`
- **Analytics GraphQL** (`/api/graphql/analytics`): session auth + `role === 'admin'` on both POST and GET
- **Internal sync routes** (3 routes): `verifyInternalSecret` — constant-time compare, `INTERNAL_API_SECRET` env var

## Helper Design (`verify-internal-secret.ts`)

- Pure-JS timing-safe comparison (no `node:crypto` — edge runtime compatible)
- Iterates `max(a,b)` chars always; length mismatch OR-d in separately
- Returns `false` (not throw) when env var not set — caller returns 401

## Verification

- `npm run build` → 0 TypeScript errors (Sentry/Turbopack warnings pre-existing)
- `npm test` → **1673 passed, 31 skipped** (matches baseline, no regressions)

## Unresolved Questions

1. `/api/internal/usage/query` previously used `INTERNAL_WEBHOOK_SECRET` env var; now uses `INTERNAL_API_SECRET`. Confirm prod env has `INTERNAL_API_SECRET` set (not the old key).
2. `validateInternalSecret` in `usage-query-helpers.ts` is now dead code (no callers). Safe to remove in a follow-up cleanup PR.
