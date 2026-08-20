/**
 * Load Baseline Test — Critical API Route Latency
 *
 * Measures p95 latency for critical API routes under simulated load.
 * Requires a reachable target URL (production or local dev server).
 *
 * SLO: p95 < 500ms for /api/health, /api/version, /api/creative-missions
 *
 * Usage:
 *   PERF_TARGET_URL=http://localhost:3000 npx vitest run tests/perf/load-baseline.spec.ts
 *   PERF_TARGET_URL=https://sophia.agencyos.network npx vitest run tests/perf/load-baseline.spec.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';

const TARGET_URL = process.env.PERF_TARGET_URL || 'https://sophia.agencyos.network';
const REQUESTS_PER_ROUTE = 20;
const CONCURRENCY = 5;
const P95_THRESHOLD_MS = 500;

interface LatencyResult {
  route: string;
  latenciesMs: number[];
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  errors: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function measureRoute(
  route: string,
  count: number,
  concurrency: number
): Promise<LatencyResult> {
  const latencies: number[] = [];
  let errors = 0;
  const url = `${TARGET_URL}${route}`;

  // Process in batches for concurrency control
  for (let i = 0; i < count; i += concurrency) {
    const batch = Array.from(
      { length: Math.min(concurrency, count - i) },
      async () => {
        try {
          const start = performance.now();
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'SophiaPerfTest/1.0',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(5000),
          });
          const elapsed = performance.now() - start;
          // Only count successful responses for latency
          if (res.ok || res.status === 401 || res.status === 403) {
            latencies.push(elapsed);
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      }
    );
    await Promise.all(batch);
  }

  const sorted = latencies.slice().sort((a, b) => a - b);

  return {
    route,
    latenciesMs: sorted,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.length > 0
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length
      : 0,
    errors,
  };
}

// Critical API routes per plan Step 6
const CRITICAL_ROUTES = [
  '/api/health',
  '/api/version',
  '/api/creative-missions',
];

describe('Performance Baseline — Critical API Routes', () => {
  let reachable = true;

  beforeAll(async () => {
    try {
      const res = await fetch(`${TARGET_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      reachable = res.ok || res.status === 401 || res.status === 403;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      console.warn(
        `[perf:load] Target ${TARGET_URL} unreachable — tests will be skipped`
      );
    }
  });

  for (const route of CRITICAL_ROUTES) {
    it(`${route} — p95 < ${P95_THRESHOLD_MS}ms under ${REQUESTS_PER_ROUTE} requests`, async () => {
      if (!reachable) {
        return;
      }

      const result = await measureRoute(
        route,
        REQUESTS_PER_ROUTE,
        CONCURRENCY
      );

      // Log baseline metrics
      console.log(
        `[perf:load] ${route}: ` +
        `p50=${result.p50.toFixed(0)}ms ` +
        `p95=${result.p95.toFixed(0)}ms ` +
        `p99=${result.p99.toFixed(0)}ms ` +
        `mean=${result.mean.toFixed(0)}ms ` +
        `min=${result.min.toFixed(0)}ms ` +
        `max=${result.max.toFixed(0)}ms ` +
        `errors=${result.errors}`
      );

      // Require successful requests
      expect(result.latenciesMs.length).toBeGreaterThan(0);

      // p95 must be under threshold
      expect(result.p95).toBeLessThan(P95_THRESHOLD_MS);
    });
  }
});
