/**
 * k6 SOAK profile — long-running steady load to detect memory leaks / drift.
 *
 * Profile: 5 VU for 20 minutes by default; capped at 25 VU and 30 minutes.
 * Goal: observe public-route latency drift on local or approved staging.
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3000 K6_DURATION=20m k6 run tests/load/k6-soak.js
 *   Remote staging requires K6_STAGING_CONFIRM=run-staging-load.
 *
 * This bounded profile is not a multi-hour soak or a capacity claim.
 */

import { publicRoutesScenario, sharedThresholds, validateEffectiveProfile } from './scenarios/public-routes.js';
import { boundedLoadDuration, boundedLoadInteger } from '../../scripts/load-test-target.mjs';

const VUS = boundedLoadInteger(__ENV.K6_VUS, 5, 1, 25, 'K6_VUS');
const DURATION = boundedLoadDuration(__ENV.K6_DURATION, '20m', 1770, 'K6_DURATION');

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

export function setup() {
  validateEffectiveProfile(25);
}

export default function () {
  validateEffectiveProfile(25);
  publicRoutesScenario();
}
