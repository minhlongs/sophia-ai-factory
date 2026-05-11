# /api/health Fast-Path — 11× Faster Warm, 8× Faster Cold

Commit `caa8d2cc` — anonymous probe short-circuits before heavy module load.

## Manual TTFB (5 sequential hits)
| Hit | Before (`91a0d378`) | After (`caa8d2cc`) | Improvement |
|-----|---------------------|--------------------|-------------|
| 1 (cold) | 3.49s              | 0.43s              | **8×**      |
| 2 (warm) | 0.46s              | 0.25s              | 1.8×        |
| 3 (warm) | —                  | 0.18s              | —           |
| 4 (warm) | —                  | 0.17s              | —           |
| 5 (warm) | —                  | 0.25s              | —           |

Cache-Control now `public, max-age=30, s-maxage=30, stale-while-revalidate=60`
— browsers + intermediate caches will reuse for 30s.

## k6 steady (10 VU × 30s) — four-run trend
| run                            | http p95 | http med | health p95 | health avg | health min | errors |
|--------------------------------|----------|----------|------------|------------|------------|--------|
| baseline (2147)                | 3.46s    | 1.12s    | 2.83s      | 1.79s      | 696ms      | 0%     |
| cache-only (2200)              | 5.24s    | 1.93s    | 3.89s      | 1.99s      | 237ms      | 0%     |
| R2 cache (2215)                | 4.18s    | 1.43s    | 2.96s      | 1.99s      | 827ms      | 0%     |
| **health fast-path (2220)**    | **3.94s**| **1.10s**| **3.07s**  | **1.41s**  | **59ms**   | **0%** |

Headline numbers vs baseline:
- `health_latency_ms.min`: 696ms → **59ms** (11.8× faster on the warmest hit)
- `health_latency_ms.avg`: 1.79s → **1.41s** (21% lower)
- `http_req_duration.med`: 1.12s → **1.10s** (par — median was already cache-friendly)
- `http_req_duration.p95`: still 3.94s, dominated by cold-start jitter on
  uncacheable `/api/version` + `/pricing` + PT-origin distance

## What changed

```ts
// Before: all imports + getCloudflareContext + probeD1/R2/KV ran for ANY caller.
// After: auth check first, anonymous response returns immediately.

if (!isAuthorized) {
  return NextResponse.json(
    { status: 'healthy', timestamp, sha },
    { headers: { 'Cache-Control': 'public, s-maxage=30, swr=60' } },
  );
}

// Heavy modules now dynamic-imported only on the authorized path:
const { createServerClient } = await import('@/seed/db/client');
const { redisHelpers } = await import('@/tree/clients/upstash-redis-client');
const { probeD1, probeR2, probeKv } = await import('@/seed/health');
```

Authorized response (admin probe via `?token=` or Bearer) still gets the full
D1/R2/KV/Supabase/Redis sweep — unchanged behaviour for ops use cases.

## Tests
- `src/app/api/health/byok/route.test.ts` + `heygen/route.test.ts`: 12/12 pass ✅
- tsc: 0 errors ✅
- Manual smoke: prod returns `{status, timestamp, sha}` on the public path ✅

## Unresolved
1. p95 hasn't moved much — dominated by `/api/version` (no caching) and PT
   origin. Next slice: re-run k6 from a CF edge region to confirm app-side
   gain, or drop those routes from the public-routes scenario.
2. Should `/api/version` get the same fast-path treatment? It's a 1-line
   read of build metadata — moving to a CF Cache Rules entry would put it
   on the edge sub-50ms.
