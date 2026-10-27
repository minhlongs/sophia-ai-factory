/**
 * guide-backend-pillars-data.ts
 * Combined 8 Pillars of Sophia AI Factory backend.
 * Layer: seed/guide
 */

import type { BackendPillar } from './guide-backend-pillars';
import { GUIDE_BACKEND_PILLARS_PART1 } from './guide-backend-pillars-part1';
import { GUIDE_BACKEND_PILLARS_PART2 } from './guide-backend-pillars-part2';

export const GUIDE_BACKEND_PILLARS: readonly BackendPillar[] = [
  ...GUIDE_BACKEND_PILLARS_PART1,
  ...GUIDE_BACKEND_PILLARS_PART2,
];
