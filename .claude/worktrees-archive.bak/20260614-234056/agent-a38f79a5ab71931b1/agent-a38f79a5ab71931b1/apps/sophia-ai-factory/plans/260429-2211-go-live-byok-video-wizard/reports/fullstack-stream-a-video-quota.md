# Video Quota Enforcement — Implementation Report

**Date:** 2026-04-29
**Phase:** Stream A — Video Quota (POST /api/heygen/create-video)
**Status:** COMPLETE

---

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `src/lib/quota/video-quota.ts` | CREATED | 78 lines — quota check + increment |
| `migrations/0033_video_usage_monthly.sql` | CREATED | Schema + PK index |
| `src/app/api/heygen/create-video/route.ts` | MODIFIED | +import, +quota check block, +increment after success |
| `src/app/api/heygen/api-routes.test.ts` | MODIFIED | +quota mock, +3 new tests |

## Architecture Decisions

- **`video-quota.ts`** uses `createServerClient()` for the read (quota check) — fits existing Supabase-compat chain.
- **`incrementVideoUsage`** uses `getD1Raw()` + raw SQL for `INSERT … ON CONFLICT DO UPDATE` — D1QueryChain does not expose `ON CONFLICT` syntax, and touching `d1-client-rpc.ts` was out-of-scope.
- Increment is **fire-and-catch** in the route: quota counter failure is logged but non-fatal so user still gets their video. Consistent with the existing DB insert pattern in the same route.
- `VIDEO_QUOTA_BY_TIER` hardcoded in `video-quota.ts` (tiers config doesn't have a `videoPerMonth` field, adding one would require touching `@/config/tiers` which is out of scope).

## Quota by Tier

| Tier | Monthly Limit |
|------|--------------|
| BASIC | 0 (blocked at 402 before quota check) |
| PREMIUM | 30 |
| ENTERPRISE | 200 |
| MASTER | 1000 |

## Test Results

- Before: 17 tests in file
- After: 20 tests (+3 quota tests)
- `npx vitest run src/app/api/heygen/api-routes.test.ts` → **20/20 passed**
- `npx tsc --noEmit` → **0 errors**

## New Tests

1. `quota: should succeed when user is under monthly limit` — 200
2. `quota: should return 429 when user is at monthly limit` — validates `{error, limit, used, resetAt}` shape, asserts HeyGen NOT called
3. `quota: should increment usage counter only after successful video creation` — asserts `incrementVideoUsage('user-1')` called once

## Migration

`migrations/0033_video_usage_monthly.sql` — run via `npx wrangler d1 migrations apply sophia-raas-db --remote` or CI migration guard.

## Unresolved Questions

- None. All acceptance criteria met.
