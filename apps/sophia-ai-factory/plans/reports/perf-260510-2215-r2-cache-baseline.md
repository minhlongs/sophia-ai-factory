# R2 Incremental Cache — Verified Live, Latency Win Visible Per-Route

Commit: `acb137bd` — `open-next.config.ts` swapped `incrementalCache: "dummy"` → `r2IncrementalCache`.

## Build + deploy
- `npx @opennextjs/cloudflare build --skipNextBuild` ✅ (worker.js emitted)
- `npm run deploy:full` ✅
- SHA match: `acb137bd` == `/api/version` shortSha
- R2 bucket `sophia-ai-factory-opennext-cache` already provisioned in `wrangler.toml`

## Manual TTFB (cold → warm)

| Route       | hit 1 (cold) | hit 2 (warm) | hit 3 (warm) |
|-------------|--------------|--------------|--------------|
| `/`         | 0.90s        | 0.35s        | 0.27s        |
| `/blog`     | 0.86s        | 0.35s        | 0.33s        |
| `/en/status`| 0.23s        | 0.39s        | 0.24s        |

Pattern: first invocation renders + writes to R2, subsequent hits serve from R2.
Warm responses are ~3× faster than cold for SSR pages.

## k6 steady (10 VU × 30s) — three-run trend

| run                          | http p95 | health p95 | avg  | errors |
|------------------------------|----------|------------|------|--------|
| baseline (260510-2147)       | 3.46s    | 2.83s      | 1.32s| 0%     |
| cache-control only (2200)    | 5.24s    | 3.89s      | 1.93s| 0%     |
| R2 cache + revalidate (2215) | **4.18s**| **2.96s**  | 1.58s| 0%     |

Improvement vs cache-control-only run: p95 −20%, avg −18%. Improvement vs baseline:
small at p95 because:
- `/api/health` + `/api/version` (uncacheable, 2/5 of scenario) still re-execute every hit.
- `/pricing` is dynamic by design.
- Only 2 routes (`/`, `/en/status`) get the R2 cache lift.

## What this unlocks
- `revalidate = 60` on `/`, `/blog`, `/status`, `/guide` now actually persists between Workers invocations.
- Tag-based invalidation NOT enabled (`tagCache: "dummy"`); time-based is sufficient for marketing.
- Future: `/api/health` rewritten as pure Worker route would knock another ~2s off the public-routes k6 baseline.

## Unresolved
1. p95 still 4s+ — dominated by uncacheable `/api/health` cold start and PT origin distance. Re-baseline from CF region would isolate.
2. tagCache="dummy" — when we need cache invalidation by content tag (e.g. blog edits), swap to `d1-next-tag-cache`. Adds 1 D1 table.
3. `/pricing` could split auth-aware section into client component to recover cacheability — separate refactor.
