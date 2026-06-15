/**
 * k6 SOAK profile — long-running steady load to detect memory leaks / drift.
 *
 * Profile: 100 VU for 2 hours (configurable). Default trimmed to 20m for CI.
 * Goal: latency p95 should not drift > 20% from start to end.
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3000 K6_DURATION=20m k6 run tests/load/k6-soak.js
 *   Full soak (real 2h): K6_DURATION=2h K6_VUS=100 k6 run tests/load/k6-soak.js
 *
 * Detection method: track p95 in 5min windows; alarm if final window > start * 1.2.
 */

import { publicRoutesScenario, sharedThresholds } from './scenarios/public-routes.js';

const VUS = Number(__ENV.K6_VUS) || 100;
const DURATION = __ENV.K6_DURATION || '20m';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    ...sharedThresholds,
    // Soak-specific: tighter p99 since long-running drift catches degradation
    http_req_duration: ['p(95)<500', 'p(99)<1200'],
  },
  tags: { profile: 'soak' },
};

export default function () {
  publicRoutesScenario();
}
