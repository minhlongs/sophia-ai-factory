/**
 * k6 SPIKE profile — burst load to validate autoscale behavior.
 *
 * Profile: 0 → 10 VU in 30s, hold 1m, ramp down in 30s; peak capped at 50.
 * Goal: observe bounded public-route behavior on local or approved staging.
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3000 k6 run tests/load/k6-spike.js
 *   K6_BASE_URL=https://staging.example.com K6_STAGING_CONFIRM=run-staging-load K6_PEAK=20 k6 run tests/load/k6-spike.js
 *
 * Production origins are rejected during module initialization.
 */

import { publicRoutesScenario, validateEffectiveProfile } from './scenarios/public-routes.js';
import { boundedLoadInteger } from '../../scripts/load-test-target.mjs';

const PEAK = boundedLoadInteger(__ENV.K6_PEAK, 10, 1, 50, 'K6_PEAK');

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

export function setup() {
  validateEffectiveProfile(50);
}

export default function () {
  validateEffectiveProfile(50);
  publicRoutesScenario();
}
