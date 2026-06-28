/**
 * k6 STRESS profile — ramp until breakpoint to find absolute limits.
 *
 * Profile: ramp 0 → 2000 VU over 5m. NO error threshold (we're finding the cliff).
 * Goal: identify VU level where p95 latency exceeds 5s OR error rate > 10%.
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3000 k6 run tests/load/k6-stress.js
 *   K6_BASE_URL=https://staging-fork-url K6_PEAK=1000 k6 run tests/load/k6-stress.js
 *
 * ⚠️  DO NOT run against production. Use staging fork or local.
 *     Will produce real cost on Cloudflare Workers + D1 read units.
 *
 * Output: time-series chart of latency vs VU count → use for scaling decisions.
 */

import { publicRoutesScenario } from './scenarios/public-routes.js';

const PEAK = Number(__ENV.K6_PEAK) || 2000;

export const options = {
  stages: [
    { duration: '1m', target: Math.floor(PEAK * 0.1) },
    { duration: '2m', target: Math.floor(PEAK * 0.5) },
    { duration: '2m', target: PEAK },
    { duration: '1m', target: 0 },
  ],
  // No fail thresholds — observation-only run. Breakpoint identified post-hoc.
  thresholds: {
    http_req_duration: ['p(95)<5000'], // soft target
    http_req_failed: ['rate<0.10'],
  },
  tags: { profile: 'stress' },
};

export default function () {
  publicRoutesScenario();
}
