/**
 * k6 bounded high-load observation profile for local or approved staging.
 *
 * Profile: ramp to 25 VU by default (peak capped at 50), fixed 6m run.
 * Goal: observe route behavior within this conservative limit only.
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3000 k6 run tests/load/k6-stress.js
 *   K6_BASE_URL=https://staging.example.com K6_STAGING_CONFIRM=run-staging-load K6_PEAK=40 k6 run tests/load/k6-stress.js
 *
 * Production origins are rejected during module initialization.
 * This is not a breakpoint or production-capacity test.
 */

import { publicRoutesScenario, validateEffectiveProfile } from './scenarios/public-routes.js';
import { boundedLoadInteger } from '../../scripts/load-test-target.mjs';

const PEAK = boundedLoadInteger(__ENV.K6_PEAK, 25, 1, 50, 'K6_PEAK');

export const options = {
  stages: [
    { duration: '1m', target: Math.floor(PEAK * 0.1) },
    { duration: '2m', target: Math.floor(PEAK * 0.5) },
    { duration: '2m', target: PEAK },
    { duration: '1m', target: 0 },
  ],
  // Bounded observation profile; this is not a capacity-to-break test.
  thresholds: {
    http_req_duration: ['p(95)<5000'], // soft target
    http_req_failed: ['rate<0.10'],
  },
  tags: { profile: 'stress' },
};

export function setup() {
  validateEffectiveProfile(50);
}

export default function () {
  validateEffectiveProfile(50);
  publicRoutesScenario();
}
