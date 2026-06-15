/**
 * Shared k6 scenario: public routes that are safe to load test (no auth, no DB writes).
 *
 * Routes:
 *   GET /                      — homepage SSR
 *   GET /en/pricing            — pricing page (cached)
 *   GET /api/health            — health check
 *   GET /api/version           — version metadata
 *   GET /[locale]/status       — public status page
 *
 * Each iteration hits all 5 routes once with realistic think time.
 * SLO thresholds:
 *   p95 < 500ms across all routes
 *   error rate < 1%
 *   /api/health p95 < 100ms (tighter — used by uptime cron)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

export const errorRate = new Rate('public_routes_errors');
export const healthLatency = new Trend('health_latency_ms');

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';

const ROUTES = [
  { path: '/', name: 'homepage' },
  { path: '/en/pricing', name: 'pricing' },
  { path: '/api/health', name: 'health', track: 'health' },
  { path: '/api/version', name: 'version' },
  { path: '/en/status', name: 'status' },
];

export function publicRoutesScenario() {
  for (const route of ROUTES) {
    const res = http.get(`${BASE_URL}${route.path}`, {
      tags: { route: route.name },
    });

    const ok = check(res, {
      [`${route.name} status 200`]: (r) => r.status === 200,
      [`${route.name} body non-empty`]: (r) => (r.body || '').length > 0,
    });

    errorRate.add(!ok);

    if (route.track === 'health') {
      healthLatency.add(res.timings.duration);
    }

    sleep(0.5);
  }
}

export const sharedThresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  http_req_failed: ['rate<0.01'],
  public_routes_errors: ['rate<0.01'],
  health_latency_ms: ['p(95)<100'],
};
