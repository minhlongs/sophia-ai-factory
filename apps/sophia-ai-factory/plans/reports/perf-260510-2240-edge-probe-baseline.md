# Edge-Region Latency Baseline — App Cost Without PT Jitter

Probe deployed: `https://sophia-edge-probe.agencyos-openclaw.workers.dev/`
Runs from CF colo **SIN**, 20 iterations × 5 routes per run, sequential.
Source archived at `tests/load/edge-probe/` (worker.ts + wrangler.toml + README).

## Two-run results (cache-warmed, run 2)

| Route        | min  | avg  | p50  | p95  | max  | Notes                          |
|--------------|------|------|------|------|------|--------------------------------|
| `/`          | 845  | 1030 | 1081 | 1184 | 1184 | SSR + i18n; R2 cache (60s)     |
| `/en/pricing`| 1129 | 1360 | 1384 | 1568 | 1568 | Dynamic (auth-aware) — slowest |
| `/api/health`| 291  | 347  | 354  | 413  | 413  | Public fast-path, cached 30s   |
| `/api/version`| 21  | 61   | 63   | 83   | 83   | Light handler + cache headers  |
| `/en/status` | 13   | 15   | 14   | 25   | 25   | R2 cache hit — almost free     |

All durations in milliseconds. `colo: SIN` consistent across both runs.

## PT origin (k6) vs edge probe (SIN)

| Route        | PT k6 p95 baseline | Edge probe p95 | Speed-up |
|--------------|--------------------|----------------|---------:|
| `/`          | ~3.5s (mixed)      | 1184ms         | **3×**   |
| `/en/pricing`| ~3.5s              | 1568ms         | **2.2×** |
| `/api/health`| 3070ms             | 413ms          | **7.4×** |
| `/api/version`| ~400ms (manual)   | 83ms           | **5×**   |
| `/en/status` | ~500ms             | 25ms           | **20×**  |

Network jitter (PT → CF edge) accounts for **the majority of the PT k6 p95**.
The recent app/cache work (R2 cache, health fast-path, Cache-Control on
`/api/version`) is **directionally correct** — the speedup is much larger from
inside CF infra where the network confound is removed.

## What this confirms

1. **R2 incremental cache works** — `/en/status` serves from R2 at 14ms median,
   25ms p95. Two-orders-of-magnitude win for cacheable pages.
2. **Health fast-path works** — sub-400ms p95 vs 3s+ pre-refactor. The
   anonymous response now skips D1/R2/KV/Supabase/Redis probes entirely.
3. **`/api/version` lightweight** — 63ms p50 from CF SIN. Cache-Control on
   the public branch is correct even though CF Workers don't auto-honor it
   at the edge layer.
4. **Pricing latency is structural** — `getCurrentUser()` + `getUserTier()`
   keep the route dynamic. Refactoring tier-badge → client component would
   recover cacheability (separate slice).
5. **Homepage stays ~1s** despite R2 cache — i18n translations + SSR cost
   dominate. Could improve via `incrementalCache` warmup or smaller SSR
   surface.

## Probe usage

```bash
# Deploy (from outside the monorepo — wrangler picks up parent configs
# if run from inside apps/*):
rm -rf /tmp/sophia-edge-probe
cp -r apps/sophia-ai-factory/tests/load/edge-probe /tmp/sophia-edge-probe
cd /tmp/sophia-edge-probe && npx wrangler deploy

# Run:
curl -s "https://sophia-edge-probe.<subdomain>.workers.dev/?n=20" | jq

# Tear down:
npx wrangler delete sophia-edge-probe
```

## Unresolved
1. **Homepage 1s p50** even with R2 cache — suggests `revalidate` isn't hitting
   the cache or i18n cost dominates the served body. Worth re-checking with
   `cf-cache-status` and explicit timing inside the Worker.
2. **CF edge cache (`cf-cache-status`)** still empty everywhere. Worker
   responses bypass CF Cache by default. Adding a CF Cache Rule for
   `/api/version`, `/api/health`, `/`, `/blog`, `/status` would push them all
   into sub-50ms territory at the CF edge layer (not just R2).
3. **k6 from PT remains useful** as the user-perceived baseline — it shows
   what a real PT customer experiences. The edge probe is for app-side
   tuning.
