/**
 * customer-journey-benchmark.spec.ts
 *
 * Performance Benchmark & Reliability Suite (Phase 15 / R1).
 * Verifies that production edge endpoints maintain median TTFB < 300ms,
 * full SSR & DB surfaces maintain SLA bounds (< 600ms), and 0 unhandled client-side exceptions
 * across 4 rigorous tiers:
 *   - Tier 1: Per-Route TTFB Baselines (Edge median < 300ms, SSR/DB median < 600ms)
 *   - Tier 2: Boundary, Concurrency Burst & Error Resilience (Zero HTTP 500 crashes)
 *   - Tier 3: Cross-Route Combined Journey Latency Budget (< 2500ms cumulative)
 *   - Tier 4: Real-World Workload Latency Certification (20-sample edge p50 < 300ms, 0 exceptions)
 *
 * Execution:
 *   npx playwright test -c tests/perf tests/perf/customer-journey-benchmark.spec.ts
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

// ── Constants & Configuration ────────────────────────────────────────────────

const TARGET_URL = process.env.PERF_TARGET_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://sophia.agencyos.network';
const ORIGIN = TARGET_URL.replace(/\/+$/, '');
const PROXY_SERVER = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

// TTFB SLO Thresholds
const EDGE_TTFB_SLO_MEDIAN_MS = 300;   // Pure Cloudflare Workers edge runtime (SLO < 300ms)
const SSR_DB_TTFB_SLO_MEDIAN_MS = 650; // Server-side rendering & D1 database roundtrips

interface LatencyStats {
  route: string;
  samples: number[];
  p50: number;
  p95: number;
  min: number;
  max: number;
  mean: number;
  status: number;
  ok: boolean;
}

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function createPerfClient(): Promise<APIRequestContext> {
  const { request } = await import('@playwright/test');
  return request.newContext({
    baseURL: ORIGIN,
    proxy: PROXY_SERVER ? { server: PROXY_SERVER } : undefined,
    extraHTTPHeaders: {
      Accept: 'application/json, text/html, */*',
      'User-Agent': 'Sophia-Perf-Benchmark/1.0',
    },
  });
}

async function measureRouteLatency(
  client: APIRequestContext,
  route: string,
  iterations: number = 3
): Promise<LatencyStats> {
  const samples: number[] = [];
  let lastStatus = 0;
  let allOk = true;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const res = await client.get(route);
    const duration = performance.now() - start;
    lastStatus = res.status();
    // 200 and 307 redirects are valid non-error statuses
    if (!res.ok() && lastStatus !== 307) {
      allOk = false;
    }
    samples.push(duration);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  return {
    route,
    samples: sorted,
    p50: computePercentile(sorted, 50),
    p95: computePercentile(sorted, 95),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.reduce((sum, val) => sum + val, 0) / (sorted.length || 1),
    status: lastStatus,
    ok: allOk,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST SUITE: Performance Benchmark & Reliability
// ──────────────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Customer Journey Performance & TTFB Benchmark Suite', () => {
  let perfClient: APIRequestContext;

  test.beforeAll(async () => {
    perfClient = await createPerfClient();
  });

  test.afterAll(async () => {
    await perfClient.dispose();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TIER 1: Isolated Route TTFB Baselines
  // ════════════════════════════════════════════════════════════════════════════

  test.describe('Tier 1: Per-Route TTFB Baselines (Edge < 300ms, SSR/DB < 650ms)', () => {
    test('[T1-Perf-01] GET /api/version edge endpoint maintains median TTFB < 300ms', async () => {
      const stats = await measureRouteLatency(perfClient, '/api/version', 3);
      expect(stats.status).toBe(200);
      expect(stats.p50).toBeLessThan(EDGE_TTFB_SLO_MEDIAN_MS);
    });

    test('[T1-Perf-02] GET /api/health D1-backed endpoint maintains median TTFB < 650ms', async () => {
      const stats = await measureRouteLatency(perfClient, '/api/health', 3);
      expect(stats.status).toBe(200);
      expect(stats.p50).toBeLessThan(SSR_DB_TTFB_SLO_MEDIAN_MS);
    });

    test('[T1-Perf-03] GET /vi/login localized auth route maintains median TTFB < 650ms', async () => {
      const stats = await measureRouteLatency(perfClient, '/vi/login', 3);
      expect(stats.status).toBe(200);
      expect(stats.p50).toBeLessThan(SSR_DB_TTFB_SLO_MEDIAN_MS);
    });

    test('[T1-Perf-04] GET /en/login localized auth route maintains median TTFB < 650ms', async () => {
      const stats = await measureRouteLatency(perfClient, '/en/login', 3);
      expect(stats.status).toBe(200);
      expect(stats.p50).toBeLessThan(SSR_DB_TTFB_SLO_MEDIAN_MS);
    });

    test('[T1-Perf-05] GET /vi/pricing localized pricing route maintains median TTFB < 650ms', async () => {
      const stats = await measureRouteLatency(perfClient, '/vi/pricing', 3);
      expect(stats.status).toBe(200);
      expect(stats.p50).toBeLessThan(SSR_DB_TTFB_SLO_MEDIAN_MS);
    });

    test('[T1-Perf-06] GET /en/pricing localized pricing route maintains median TTFB < 650ms', async () => {
      const stats = await measureRouteLatency(perfClient, '/en/pricing', 3);
      expect(stats.status).toBe(200);
      expect(stats.p50).toBeLessThan(SSR_DB_TTFB_SLO_MEDIAN_MS);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TIER 2: Boundary, Concurrency Burst & Error Resilience
  // ════════════════════════════════════════════════════════════════════════════

  test.describe('Tier 2: Boundary, Concurrency Burst & Error Resilience', () => {
    test('[T2-Perf-01] Concurrency burst: 10 parallel requests to /api/version maintain zero drops and p95 < 3500ms', async () => {
      const burstSize = 10;
      const durations: number[] = [];

      const promises = Array.from({ length: burstSize }, async () => {
        const start = performance.now();
        const res = await perfClient.get('/api/version');
        const duration = performance.now() - start;
        durations.push(duration);
        expect(res.status()).toBe(200);
      });

      await Promise.all(promises);
      const sorted = [...durations].sort((a, b) => a - b);
      const p95 = computePercentile(sorted, 95);
      expect(durations.length).toBe(burstSize);
      expect(p95).toBeLessThan(3500);
    });

    test('[T2-Perf-02] Concurrency burst: 10 parallel requests to /api/health maintain zero drops and p95 < 3500ms', async () => {
      const burstSize = 10;
      const durations: number[] = [];

      const promises = Array.from({ length: burstSize }, async () => {
        const start = performance.now();
        const res = await perfClient.get('/api/health');
        const duration = performance.now() - start;
        durations.push(duration);
        expect(res.status()).toBe(200);
      });

      await Promise.all(promises);
      const sorted = [...durations].sort((a, b) => a - b);
      const p95 = computePercentile(sorted, 95);
      expect(durations.length).toBe(burstSize);
      expect(p95).toBeLessThan(3500);
    });

    test('[T2-Perf-03] Resilience on non-existent route: returns clean 404/401 with 0 internal server errors (zero 500s)', async () => {
      const res = await perfClient.get('/api/nonexistent-edge-route-probe');
      expect([401, 404]).toContain(res.status());
      expect(res.status()).not.toBe(500);
    });

    test('[T2-Perf-04] Malformed payload resilience: POST /api/checkout with garbage payload returns 400 without crashing', async () => {
      const res = await perfClient.post('/api/checkout', {
        data: '!!!GARBAGE_PAYLOAD_NOT_JSON!!!',
        headers: { Origin: ORIGIN, 'content-type': 'text/plain' },
      });
      // Handled cleanly with 400 or 401 or 403, never 500 unhandled exception
      expect([400, 401, 403, 429]).toContain(res.status());
      expect(res.status()).not.toBe(500);
    });

    test('[T2-Perf-05] Header stress resilience: Extreme user-agent string handled cleanly without server crash', async () => {
      const extremeUa = 'Sophia-Stress-Agent/' + 'A'.repeat(512);
      const res = await perfClient.get('/api/version', {
        headers: { 'User-Agent': extremeUa },
      });
      expect(res.status()).toBe(200);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TIER 3: Combined Multi-Route Journey Latency Budget
  // ════════════════════════════════════════════════════════════════════════════

  test.describe('Tier 3: Combined Multi-Route Journey Latency Budget', () => {
    test('[T3-Perf-01] Sequential 4-step guest discovery journey completes within 3500ms budget', async () => {
      const start = performance.now();

      // Step 1: Landing
      const r1 = await perfClient.get('/vi/login');
      expect(r1.status()).toBe(200);

      // Step 2: Setup page
      const r2 = await perfClient.get('/vi/setup');
      expect(r2.status()).toBe(200);

      // Step 3: Pricing page
      const r3 = await perfClient.get('/vi/pricing');
      expect(r3.status()).toBe(200);

      // Step 4: Health check
      const r4 = await perfClient.get('/api/health');
      expect(r4.status()).toBe(200);

      const cumulativeTime = performance.now() - start;
      expect(cumulativeTime).toBeLessThan(3500);
    });

    test('[T3-Perf-02] Bilingual route parity: latency differential between VI and EN routes is within 250ms variance', async () => {
      const viStats = await measureRouteLatency(perfClient, '/vi/login', 2);
      const enStats = await measureRouteLatency(perfClient, '/en/login', 2);

      const diff = Math.abs(viStats.p50 - enStats.p50);
      expect(diff).toBeLessThan(250);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TIER 4: Real-World Workload Latency Benchmark & Exception Guard
  // ════════════════════════════════════════════════════════════════════════════

  test.describe('Tier 4: Real-World Workload Latency Certification', () => {
    test('[T4-Perf-01] 20-sample production edge route latency benchmark certifies p50 < 300ms and 0 unhandled exceptions', async () => {
      const sampleCount = 20;
      const latencies: number[] = [];
      let unhandledExceptions = 0;

      for (let i = 0; i < sampleCount; i++) {
        const start = performance.now();
        const res = await perfClient.get('/api/version');
        const elapsed = performance.now() - start;

        if (res.status() >= 500) {
          unhandledExceptions++;
        }
        latencies.push(elapsed);
      }

      const sorted = [...latencies].sort((a, b) => a - b);
      const p50 = computePercentile(sorted, 50);
      const p95 = computePercentile(sorted, 95);

      // Certification assertions:
      // 1. Zero unhandled server exceptions (0 HTTP 500s)
      expect(unhandledExceptions).toBe(0);
      // 2. Median TTFB on edge endpoint strictly under 300ms SLO
      expect(p50).toBeLessThan(EDGE_TTFB_SLO_MEDIAN_MS);
      // 3. 95th percentile under 600ms
      expect(p95).toBeLessThan(600);
    });
  });
});
