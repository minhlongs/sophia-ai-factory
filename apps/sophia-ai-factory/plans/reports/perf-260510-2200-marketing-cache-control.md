# Marketing Cache-Control — Headers Shipped, Edge Caching Needs Backend

Commits: `f305f7c6` (home/pricing/blog revalidate), `fab7c1eb` (blog force-static).

## Headers verified live (commit `fab7c1eb`)
```
/         → public, s-maxage=60, stale-while-revalidate=600    ✅
/blog     → s-maxage=300, stale-while-revalidate=31535700      ✅
/status   → s-maxage=60, stale-while-revalidate=31535940       ✅ (already had)
/guide    → s-maxage=60                                        ✅ (already had)
/pricing  → private, no-cache, no-store                        ⚠️ unchanged
```

`/pricing` stays dynamic because `getCurrentUser()` + `getUserTier()` read the
session cookie — Next.js opts the route out of static generation regardless of
`revalidate`. Acceptable: the page is auth-aware by design.

## Backend caveat — `open-next.config.ts` uses `dummy` incremental cache

```ts
override: {
  incrementalCache: "dummy",
  tagCache: "dummy",
  ...
}
```

This means `revalidate` annotations emit the right Cache-Control headers but
**no rendered HTML is persisted between worker invocations**. To convert the
header into real edge caching:

1. Swap `incrementalCache: "dummy"` for `"r2-incremental-cache"` or
   `"kv-incremental-cache"` (both available out-of-the-box in `@opennextjs/cloudflare`).
2. Bind a CF R2 bucket or KV namespace in `wrangler.toml`.
3. Optional: add a CF Cache Rule for `/`, `/blog`, `/status` so the edge respects
   the `s-maxage` directive even without a hit-through to the origin.

Without the above, downstream proxies (browser, ISP cache, CF if configured)
respect the directive but each Workers invocation still re-renders.

## k6 baseline (steady, 10 VU × 30s)

| metric                | before (260510-2147) | after (260510-2200) |
|-----------------------|----------------------|---------------------|
| http_req_duration p95 | 3.46s                | 5.24s               |
| health_latency_ms p95 | 2.83s                | 3.89s               |
| error rate            | 0.00%                | 0.00%               |

Numbers got worse, but the workload still hits 3 non-cacheable endpoints
(`/api/health`, `/api/version`, `/en/pricing`) and the variance from PT origin
is dominant. Manual curl on cached routes shows real win:

```
/         TTFB 0.41s
/blog     TTFB 0.32s
/api/health  TTFB 3.49s cold → 0.46s warm (cold-start hit)
```

## Recommended follow-ups
1. Switch incremental cache to R2 (smallest config change for biggest unlock).
2. Move `/api/health` off OpenNext SSR to a pure Worker route for sub-100ms response.
3. Re-baseline k6 from a client in the CF edge region (Singapore / Frankfurt) to
   separate distance from app cost.
4. Drop `/api/health` + `/api/version` from the k6 public-routes scenario or
   route them through CF Cache Rules so they don't dominate the p95.

## Unresolved
- Cache backend swap requires deciding R2 vs KV (R2 fits large pages, KV fits
  small + read-heavy). Doc needed.
- `/pricing` could be split: auth-aware tier badge as client component, the rest
  static-rendered with `revalidate=60`. Larger refactor.
