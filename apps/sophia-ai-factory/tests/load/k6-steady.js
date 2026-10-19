/**
 * k6 STEADY profile — baseline latency under sustained moderate load.
 *
 * Profile: 10 VU for 30 seconds by default; capped at 50 VU and 30 minutes.
 * Goal: observe public-route latency on local or approved staging.
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3000 k6 run tests/load/k6-steady.js
 *   K6_BASE_URL=https://staging.example.com K6_STAGING_CONFIRM=run-staging-load K6_VUS=20 k6 run tests/load/k6-steady.js
 *
 * Production origins are rejected during module initialization.
 */

import { publicRoutesScenario, sharedThresholds, validateEffectiveProfile } from './scenarios/public-routes.js';
import { boundedLoadDuration, boundedLoadInteger } from '../../scripts/load-test-target.mjs';

const VUS = boundedLoadInteger(__ENV.K6_VUS, 10, 1, 50, 'K6_VUS');
const DURATION = boundedLoadDuration(__ENV.K6_DURATION, '30s', 1770, 'K6_DURATION');

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: sharedThresholds,
  tags: { profile: 'steady' },
};

export function setup() {
  validateEffectiveProfile(50);
}

export default function () {
  validateEffectiveProfile(50);
  publicRoutesScenario();
}
