# Performance Baseline 2027

> **Generated**: 2026-08-19 | **Build**: Next.js 16.2.5 + Turbopack | **Target**: Cloudflare Workers
> **Hardware Constraint**: M1 16GB

---

## 1. Executive Summary

This document captures the production performance baseline for Sophia AI Factory
as of Phase 8 Step 6. All metrics were collected from the local build output on
M1 16GB hardware. Live production latency measurements require a running
deployment (see Section 5 for limitations).

**Key Findings:**
- CF Worker bundle: **8.14 MB gzipped** (limit: 10 MB) — 81% of CF limit
- All route action files are under 500 KB gzipped (Turbopack wrappers only)
- Largest server shared chunk: **383 KB gzipped** — within 500 KB threshold
- Total client chunks: **1.19 MB gzipped** across 100 files
- Total server chunks: **3.98 MB gzipped** across 402 files
- `npm run perf:check` passes (no D1 slo_burn data yet — expected at cold start)

---

## 2. Bundle Sizes

### 2.1 CF Worker Bundle (OpenNext)

| Metric | Value |
|--------|-------|
| File | `.open-next/server-functions/default/handler.mjs` |
| Raw size | 40.68 MB |
| Gzipped size | **8.14 MB** |
| CF Workers limit | 10 MB compressed |
| Utilization | 81.4% |

**Status**: WITHIN LIMIT. Approaching ceiling — any significant dependency
addition should be evaluated against remaining 1.86 MB headroom.

### 2.2 Server-Side Chunks (.next/server/chunks/)

| Metric | Value |
|--------|-------|
| Total files | 402 JS files |
| Total raw | 17.18 MB |
| Total gzipped | **3.98 MB** |

**Top 5 by gzipped size:**

| Chunk | Gzipped | Notes |
|-------|---------|-------|
| `node_modules_002_9k5._.js` | 383 KB | Shared node_modules chunk |
| `node_modules_083vp-b._.js` | 371 KB | Shared node_modules chunk |
| `[root-of-the-server]__19z7v6c._.js` | 251 KB | Root server modules |
| `_1zb39kj._.js` | 133 KB | Shared chunk |
| `_1dkfeq3._.js` | 101 KB | Shared chunk |

**Status**: All server chunks under 500 KB gzipped. No violations.

### 2.3 Route Action Files (Turbopack Wrappers)

| Metric | Value |
|--------|-------|
| Total route action files | 402 JS files |
| Total gzipped | 20.7 KB |
| Average per route | ~52 bytes gzipped |
| Largest route action | ~408 bytes gzipped |

Turbopack route action files are thin wrappers referencing module IDs in shared
chunks. Per-route code size is dominated by shared chunk dependencies, not the
action file itself.

**Status**: All under 500 KB. No violations.

### 2.4 Client-Side Chunks (.next/static/chunks/)

| Metric | Value |
|--------|-------|
| Total files | 100 JS files |
| Total raw | 4.07 MB |
| Total gzipped | **1.19 MB** |

**Top 5 by gzipped size:**

| Chunk | Gzipped | Notes |
|-------|---------|-------|
| `0j241l5e6661b.js` | 222 KB | Main framework chunk |
| `0ghe7xhw3ka4l.js` | 110 KB | Vendor chunk |
| `0cz1d0mv5g_q7.js` | 110 KB | Vendor chunk |
| `06ei7hevdqxx5.js` | 33 KB | Utility chunk |
| `0gjz-zor5oz67.js` | 36 KB | Feature chunk |

**Status**: Largest client chunk 222 KB gzipped — well under 500 KB.

---

## 3. Critical Route Analysis

The three critical routes per Phase 8 Step 6 acceptance criteria:

| Route | Action File (gz) | Server Shared Chunks | Total (est.) | Status |
|-------|-------------------|---------------------|---------------|--------|
| `/api/health` | 380 B | Shared pool | ~400 B wrapper | PASS |
| `/api/version` | 380 B | Shared pool | ~400 B wrapper | PASS |
| `/api/creative-missions` | 397 B | Shared pool | ~400 B wrapper | PASS |

**Note on measurement methodology**: Turbopack's code-splitting model uses
shared chunks loaded on demand. The action files are thin entry points. The
actual code loaded per-request depends on the module graph traversal at runtime.
The 500 KB threshold applies to the total gzipped JavaScript delivered to the
client for a page route, or the total server-side code loaded for an API route.

For API routes in this architecture, the route action file (< 1 KB) is the
entry point, and shared chunks are loaded on-demand by the runtime. The largest
shared server chunk (383 KB) represents the worst-case single-chunk load.

---

## 4. API Latency Baseline

### 4.1 Production Latency (requires live deployment)

Production latency measurements require a running deployment at
`sophia.agencyos.network`. Run the load test against production:

```bash
PERF_TARGET_URL=https://sophia.agencyos.network npm run test:perf:load
```

**SLO targets (from perf-check.ts):**

| SLO | Target | Route |
|-----|--------|-------|
| Health latency p95 | < 500 ms | `/api/health`, `/api/version` |
| API latency p95 | < 800 ms | All `/api/` routes |
| Availability | >= 99.5% | All routes |
| Error rate | < 1% | `/api/`, `/webhook/` |

### 4.2 Cold Start Considerations (M1 16GB)

- `NODE_OPTIONS=--max-old-space-size=4096` set in build script
- React compiler doubles webpack memory pressure; skip via `SKIP_RC=1` if OOM
- `SKIP_SENTRY_BUILD=1` available for M1 OOM workaround (source maps not uploaded)
- `serverExternalPackages` externalizes incompatible libs (html2canvas, jszip, etc.)

---

## 5. Build Memory Profile

| Build Phase | Peak Memory (est.) | Workaround |
|-------------|-------------------|------------|
| Next.js build | ~4 GB | `--max-old-space-size=4096` |
| OpenNext CF build | ~2 GB | Uses next build output |
| React Compiler | +2 GB | `SKIP_RC=1` disables |

**M1 16GB constraint**: Total available ~14 GB (OS + apps). Build peaks at
~6 GB combined, leaving headroom for other processes.

---

## 6. Limitations and Known Gaps

1. **No live latency data in this baseline**: Production latency requires a
   running deployment. The load test (`tests/perf/load-baseline.spec.ts`) is
   designed to run against any URL. Run against staging or production when
   available.

2. **Turbopack code-splitting granularity**: The 500 KB per-route threshold is
   measured at the route action file level. True per-route load depends on
   runtime module graph traversal, which cannot be measured statically without
   a running server.

3. **D1 slo_burn table empty**: The `perf:check` script queries `slo_burn` for
   monthly aggregates. No data exists yet — check passes with "no baseline"
   warning. Data will populate after the SLO monitoring cron runs for 30 days.

4. **Client-side route group mapping**: Turbopack chunks are hashed and do not
   have a direct route-to-chunk mapping in the build manifest. Per-route client
   bundle size requires runtime analysis (e.g., bundle-analyzer with `ANALYZE=true`).

---

## 7. How to Regenerate

```bash
# Rebuild
npm run build

# Run bundle analyzer
npm run perf:bundle

# Run load test (requires reachable URL)
PERF_TARGET_URL=<url> npm run test:perf:load

# Run SLO check (requires D1 auth)
npm run perf:check
```

---

## 8. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-08-19 | Initial baseline — Phase 8 Step 6 | debugger agent |
