# G2 Wave 12 — V1 Tier-Aware Rate-Limit Overlay

**Date:** 2026-05-09
**Phase:** 2, Wave 12, Group G2
**Base commit:** 8e3d48d7

## Route Enumeration

- Total v1 route files: **37**
- Already wrapped (pre-wave): **7** (usage/route, usage/batch/route, api-keys/route, sops/route, campaigns/create/route, missions/route POST, factory/url-to-revenue/route)
- Newly wrapped this wave: **30**

All 37 routes now export handlers via `withRateLimit(...)`.

## Metric Category Distribution

| Category | Routes | Config |
|---|---|---|
| Expensive (LLM, upload, validate) | 5 | 5–20 req/min |
| Write/mutate (POST/PUT/PATCH/DELETE) | 12 | 10–30 req/min |
| Read (GET) + dashboard | 13 | 60 req/min |
| Defense-in-depth (already had inline RL) | 3 | Outer wrapper 5–120 req/min; inner custom logic preserved |
| SSE streams | 2 | 20 req/min; `addHeaders: false` for stream routes |
| RaaS gateway (quota/overage, have JWT+checkApiRateLimit) | 2 | Outer 120 req/min; inner tenant-scoped RL preserved |

## Parameterized Route Pattern

Routes with `{ params }` second arg use closure invocation:
```ts
export async function GET(req, { params }) {
  const { id } = await params;
  return withRateLimit(async (r) => { /* handler */ }, opts)(req);
}
```

SSE/streaming `Response` handlers cast via `as unknown as (request) => Promise<NextResponse>` to satisfy the generic constraint. The wrapper's duck-type `headers.set` guard handles the actual runtime safely.

## Tsc + Test Results

- **TypeScript:** 0 errors (`npx tsc --noEmit`)
- **Tests:** 2894 passed, 31 skipped — no regressions vs baseline

## Deferred / Notes

- `missions/route.ts` GET was unwrapped (only POST was wrapped in Wave 1-10). Added `withRateLimit` wrapper this wave.
- `api-keys/[id]/route.ts`, `api-keys/[id]/rotate/route.ts`, `webhooks/[id]/test/route.ts` already had inline `globalRateLimiter.checkLimit`; outer `withRateLimit` added as defense-in-depth overlay.
- Tier param is `'auto'` semantically (wrapper reads `getRateLimitConfig(pathname)` from `rate-limit-config.ts` which maps tiers). Explicit `config` overrides were set per endpoint cost profile.
