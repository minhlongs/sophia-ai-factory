---
title: "Phase 02 — Instrument Metrics Export"
description: "Extend metrics telemetry to export to Workers Analytics Engine and Sentry custom metrics"
status: complete
priority: P1
effort: 2.5h
branch: feat/slo-monitoring-hybrid
depends_on: ["phase-01-define-slos-and-schema.md"]
---

# Phase 02 — Instrument Metrics Export

## Context Links
- Plan: `../plan.md`
- Phase 01: `./phase-01-define-slos-and-schema.md`
- Current metrics: `src/seed/observability/telemetry/metrics.ts`
- Middleware: `src/middleware.ts`
- Sentry options: `src/seed/observability/sentry-options.ts`
- Workers Analytics Engine docs: https://developers.cloudflare.com/workers/observability/analytics-engine/

## Requirements

### Functional
- [ ] Extend `metrics.ts` to write to Workers Analytics Engine (WAE)
- [ ] Instrument `middleware.ts` to record request metrics on every request
- [ ] Export custom metrics to Sentry (error rate, latency p95)
- [ ] Support route grouping for cardinality control
- [ ] Add WAE dataset binding to `wrangler.toml`

### Non-Functional
- [ ] Zero performance impact on request path (async, fire-and-forget)
- [ ] Memory bounded (existing ring buffer + WAE sampling)
- [ ] Graceful degradation if WAE/Sentry unavailable
- [ ] No PII in metrics (route patterns only, no user IDs)

## Files to Modify/Create

| Action | File | Layer | Notes |
|--------|------|-------|-------|
| Modify | `src/seed/observability/telemetry/metrics.ts` | seed | Add WAE + Sentry export |
| Modify | `src/middleware.ts` | forest | Instrument request recording |
| Modify | `wrangler.toml` | config | Add `analytics_engine` binding |
| Create | `src/seed/observability/telemetry/wae-client.ts` | seed | WAE write helper |
| Create | `src/seed/observability/telemetry/sentry-metrics.ts` | seed | Sentry custom metrics |

## Workers Analytics Engine Binding

Add to `wrangler.toml`:

```toml
# Analytics Engine binding for SLO metrics
[analytics_engine]
datasets = [
  { binding = "ANALYTICS", dataset = "sophia_slo_metrics" }
]
```

## WAE Client (`src/seed/observability/telemetry/wae-client.ts`)

```typescript
/**
 * Workers Analytics Engine client — fire-and-forget writes.
 * Uses Cloudflare's native `AnalyticsEngineDataset` binding.
 * Sampling: 1 in 100 requests (configurable via env).
 */

interface WAEEvent {
  // Required: timestamp in milliseconds since epoch
  timestamp: number;
  // Required: dataset-specific fields
  route: string;           // Normalized route pattern (e.g., "/api/v1/campaigns/:id")
  method: string;          // HTTP method
  status: number;          // HTTP status code
  duration_ms: number;     // Response duration
  is_error: boolean;       // 5xx or timeout
  // Optional: dimensions for filtering
  tier?: string;           // User tier: BASIC, PREMIUM, ENTERPRISE, MASTER
  region?: string;         // CF colo code
  webhook_type?: string;   // For webhook routes: nowpayments, clickbank, telegram, etc.
}

declare global {
  interface CloudflareEnv {
    ANALYTICS: AnalyticsEngineDataset;
  }
}

const SAMPLING_RATE = Number(process.env.WAE_SAMPLING_RATE ?? '0.01'); // 1%

function shouldSample(): boolean {
  return Math.random() < SAMPLING_RATE;
}

function normalizeRoute(pathname: string): string {
  // Replace dynamic segments with placeholders to control cardinality
  return pathname
    .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:uuid')
    .replace(/\/[a-f0-9]{24}/gi, '/:id')
    .replace(/\/[0-9]+/gi, '/:id')
    .replace(/\/[^/]+\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?)/gi, '/:asset');
}

export function writeWAE(event: WAEEvent): void {
  try {
    if (!shouldSample()) return;
    
    const env = (globalThis as unknown as { ANALYTICS?: AnalyticsEngineDataset }).ANALYTICS;
    if (!env) {
      // Binding not available (local dev, tests) — silently skip
      return;
    }
    
    env.writeDataPoint({
      blobs: [
        event.route,
        event.method,
        event.tier ?? 'unknown',
        event.region ?? 'unknown',
        event.webhook_type ?? '',
      ],
      doubles: [
        event.timestamp,
        event.duration_ms,
        event.status,
        event.is_error ? 1 : 0,
      ],
      indexes: [
        event.route,
        event.method,
        event.status.toString(),
      ],
    });
  } catch {
    // Never throw from metrics — best effort only
  }
}

export function recordRequestMetrics(params: {
  pathname: string;
  method: string;
  status: number;
  durationMs: number;
  tier?: string;
  region?: string;
  webhookType?: string;
}): void {
  const route = normalizeRoute(params.pathname);
  const isError = params.status >= 500;
  
  writeWAE({
    timestamp: Date.now(),
    route,
    method: params.method,
    status: params.status,
    duration_ms: params.durationMs,
    is_error: isError,
    tier: params.tier,
    region: params.region,
    webhook_type: params.webhookType,
  });
}
```

## Sentry Custom Metrics (`src/seed/observability/telemetry/sentry-metrics.ts`)

```typescript
/**
 * Sentry Custom Metrics — for alerting on SLO thresholds.
 * Uses Sentry's Metrics API (requires Sentry SDK v8+).
 * Flushed periodically (not per-request) to minimize overhead.
 */

import * as Sentry from '@sentry/nextjs';

interface SLOMetric {
  name: string;
  value: number;
  unit: 'millisecond' | 'percent' | 'count' | 'ratio';
  tags: Record<string, string>;
}

const METRICS_BUFFER: SLOMetric[] = [];
const FLUSH_INTERVAL_MS = 60_000; // 1 minute
let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(flushMetrics, FLUSH_INTERVAL_MS);
}

function stopFlushTimer(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export function recordSLOMetric(metric: SLOMetric): void {
  METRICS_BUFFER.push(metric);
  if (METRICS_BUFFER.length >= 100) flushMetrics(); // Backpressure
}

function flushMetrics(): void {
  if (METRICS_BUFFER.length === 0) return;
  
  const toFlush = [...METRICS_BUFFER];
  METRICS_BUFFER.length = 0;
  
  try {
    for (const m of toFlush) {
      Sentry.metrics.increment(m.name, m.value, {
        unit: m.unit,
        tags: m.tags,
      });
    }
  } catch {
    // Silent fail — metrics are best-effort
  }
}

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  startFlushTimer();
}

// Export for testing
export { METRICS_BUFFER, flushMetrics, startFlushTimer, stopFlushTimer };

// Convenience functions for SLO metrics
export const SLOMetrics = {
  availability(good: number, total: number, tags: Record<string, string> = {}): void {
    const rate = total > 0 ? good / total : 1;
    recordSLOMetric({
      name: 'slo.availability',
      value: rate,
      unit: 'ratio',
      tags: { ...tags, target: '0.995' },
    });
  },
  
  latencyP95(route: string, p95Ms: number, tags: Record<string, string> = {}): void {
    recordSLOMetric({
      name: 'slo.latency_p95',
      value: p95Ms,
      unit: 'millisecond',
      tags: { ...tags, route, target: '800' },
    });
  },
  
  errorRate(errors: number, total: number, tags: Record<string, string> = {}): void {
    const rate = total > 0 ? errors / total : 0;
    recordSLOMetric({
      name: 'slo.error_rate',
      value: rate,
      unit: 'ratio',
      tags: { ...tags, target: '0.01' },
    });
  },
  
  webhookDelivery(webhookType: string, durationMs: number, tags: Record<string, string> = {}): void {
    recordSLOMetric({
      name: 'slo.webhook_delivery_p95',
      value: durationMs,
      unit: 'millisecond',
      tags: { ...tags, webhook_type: webhookType, target: '300000' }, // 5 min = 300,000 ms
    });
  },
};
```

## Extended Metrics (`src/seed/observability/telemetry/metrics.ts`)

```typescript
/**
 * In-memory metrics ring buffer + WAE + Sentry export.
 * Tracks request count, error count, and response durations per route.
 */

import { recordRequestMetrics } from './wae-client';
import { SLOMetrics } from './sentry-metrics';

const MAX_DURATIONS = 1000;
const SNAPSHOT_INTERVAL_MS = 60_000; // 1 minute

interface RouteStats {
  count: number;
  errors: number;
  durations: number[];
}

const statsMap = new Map<string, RouteStats>();
let snapshotTimer: ReturnType<typeof setInterval> | null = null;

function getOrCreateStats(route: string): RouteStats {
  let s = statsMap.get(route);
  if (!s) {
    s = { count: 0, errors: 0, durations: [] };
    statsMap.set(route, s);
  }
  return s;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function snapshotAndExport(): void {
  const now = Date.now();
  const windowStart = now - SNAPSHOT_INTERVAL_MS;
  
  for (const [route, stats] of statsMap.entries()) {
    if (stats.count === 0) continue;
    
    const sorted = [...stats.durations].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);
    
    // Export to Sentry for alerting
    SLOMetrics.latencyP95(route, p95, { route });
    SLOMetrics.errorRate(stats.errors, stats.count, { route });
    SLOMetrics.availability(stats.count - stats.errors, stats.count, { route });
    
    // Reset for next window (sliding window approximation)
    stats.durations = stats.durations.slice(-100); // Keep last 100 for continuity
  }
}

export function record(route: string, durationMs: number, isError: boolean): void {
  const s = getOrCreateStats(route);
  s.count++;
  if (isError) s.errors++;
  s.durations.push(durationMs);
  if (s.durations.length > MAX_DURATIONS) s.durations.shift();
}

export function recordWithContext(params: {
  route: string;
  durationMs: number;
  isError: boolean;
  method: string;
  status: number;
  tier?: string;
  region?: string;
  webhookType?: string;
}): void {
  // In-memory
  record(params.route, params.durationMs, params.isError);
  
  // WAE (sampled, async)
  recordRequestMetrics({
    pathname: params.route,
    method: params.method,
    status: params.status,
    durationMs: params.durationMs,
    tier: params.tier,
    region: params.region,
    webhookType: params.webhookType,
  });
}

export function getSnapshot(): Array<{
  route: string;
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}> {
  const result: Array<{
    route: string;
    count: number;
    errors: number;
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
  }> = [];
  
  for (const [route, s] of statsMap.entries()) {
    if (s.count === 0) continue;
    const sorted = [...s.durations].sort((a, b) => a - b);
    result.push({
      route,
      count: s.count,
      errors: s.errors,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      errorRate: s.errors / s.count,
    });
  }
  return result;
}

export function startSnapshotTimer(): void {
  if (snapshotTimer) return;
  snapshotTimer = setInterval(snapshotAndExport, SNAPSHOT_INTERVAL_MS);
}

export function stopSnapshotTimer(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
}

export function reset(): void {
  statsMap.clear();
}
```

## Middleware Instrumentation (`src/middleware.ts`)

```typescript
// Add to existing middleware.ts - wrap response recording

import { recordWithContext, startSnapshotTimer } from '@/seed/observability/telemetry/metrics';

// Start snapshot timer on first request (module init)
startSnapshotTimer();

export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  
  // ... existing middleware logic ...
  
  // Capture response
  const response = await NextResponse.next();
  
  // Record metrics after response is ready
  const durationMs = performance.now() - startTime;
  const status = response.status;
  const isError = status >= 500;
  
  // Extract tier from auth (if available)
  let tier: string | undefined;
  try {
    const user = await getCurrentUser();
    if (user) tier = user.tier;
  } catch {
    // Ignore auth errors in middleware
  }
  
  // Extract region from CF headers
  const region = request.headers.get('cf-ray')?.split('-')[1] ?? 
                 request.headers.get('cf-ipcountry') ?? 
                 'unknown';
  
  // Detect webhook type
  let webhookType: string | undefined;
  if (pathname.startsWith('/api/webhooks/')) {
    if (pathname.includes('nowpayments')) webhookType = 'nowpayments';
    else if (pathname.includes('clickbank')) webhookType = 'clickbank';
    else if (pathname.includes('telegram')) webhookType = 'telegram';
    else if (pathname.includes('did')) webhookType = 'did';
    else if (pathname.includes('heygen')) webhookType = 'heygen';
  }
  
  recordWithContext({
    route: pathname,
    method,
    status,
    durationMs,
    isError,
    tier,
    region,
    webhookType,
  });
  
  return response;
}
```

## Implementation Steps

1. **Add WAE binding to wrangler.toml**
   ```bash
   # Add [analytics_engine] section after line ~200
   ```

2. **Create WAE client**
   ```bash
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/observability/telemetry/wae-client.ts << 'EOF'
   # [content from above]
   EOF
   ```

3. **Create Sentry metrics module**
   ```bash
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/observability/telemetry/sentry-metrics.ts << 'EOF'
   # [content from above]
   EOF
   ```

4. **Extend metrics.ts**
   ```bash
   # Replace existing metrics.ts with extended version
   ```

5. **Update middleware.ts**
   ```bash
   # Add imports and recordWithContext call
   ```

6. **Update barrel exports**
   ```bash
   # Add exports to src/seed/observability/telemetry/index.ts
   ```

7. **Type-check and test**
   ```bash
   cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
   npm run type-check
   npm test -- src/seed/observability/telemetry/
   ```

## Tests / Validation

- [ ] `npm run type-check` passes (0 errors)
- [ ] Unit tests for `wae-client.ts`: normalizeRoute, shouldSample, writeWAE
- [ ] Unit tests for `sentry-metrics.ts`: buffer flush, metric recording
- [ ] Integration test: middleware records metrics on test request
- [ ] Local dev: WAE writes mocked, no errors in console
- [ ] Load test: 1000 req/s, memory stable, no blocked event loop

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WAE binding not available in local dev | High | Low | Graceful no-op when binding undefined |
| High cardinality from route normalization gaps | Medium | High | Test normalizeRoute with all route patterns; add integration test |
| Sentry metrics API rate limits | Low | Medium | Buffer + flush interval; max 100 metrics/flush |
| Middleware performance overhead | Low | High | Fire-and-forget WAE; in-memory ring buffer O(1) |

## Next Steps

After Phase 02 completes:
- Phase 03: Create monthly cron job to compute burn-rate from WAE
- Phase 03: Configure Sentry alert rules for SLO thresholds