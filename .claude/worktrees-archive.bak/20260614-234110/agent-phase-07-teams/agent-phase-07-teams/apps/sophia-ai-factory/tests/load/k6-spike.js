/**
 * k6 SPIKE profile — burst load to validate autoscale behavior.
 *
 * Profile: 0 → 500 VU in 30s, hold 1m, ramp down to 0 in 30s.
 * Goal: ensure CF Workers + D1 absorb traffic spike without elevated error rate.
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3000 k6 run tests/load/k6-spike.js
 *   K6_BASE_URL=https://sophia.agencyos.network K6_PEAK=200 k6 run tests/load/k6-spike.js
 *
 * SLO: error rate < 2% during peak (looser than steady — spike acceptance tier).
 */

import { publicRoutesScenario } from './scenarios/public-routes.js';

const PEAK = Number(__ENV.K6_PEAK) || 500;

export const options = {
  stages: [
    { duration: '30s', target: PEAK },
    { duration: '1m', target: PEAK },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.02'],
    public_routes_errors: ['rate<0.02'],
  },
  tags: { profile: 'spike' },
};

export default function () {
  publicRoutesScenario();
}
