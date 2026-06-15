/**
 * k6 STEADY profile — baseline latency under sustained moderate load.
 *
 * Profile: 50 VU for 10 minutes (configurable via K6_DURATION).
 * Goal: confirm p95 latency stable under expected daily load.
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3000 k6 run tests/load/k6-steady.js
 *   K6_BASE_URL=https://sophia.agencyos.network K6_VUS=20 k6 run tests/load/k6-steady.js
 *
 * Note: do NOT run against production at full scale without staging-fork D1.
 */

import { publicRoutesScenario, sharedThresholds } from './scenarios/public-routes.js';

const VUS = Number(__ENV.K6_VUS) || 50;
const DURATION = __ENV.K6_DURATION || '10m';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: sharedThresholds,
  tags: { profile: 'steady' },
};

export default function () {
  publicRoutesScenario();
}
