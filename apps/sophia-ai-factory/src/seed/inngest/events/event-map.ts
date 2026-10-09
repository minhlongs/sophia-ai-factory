/**
 * @file event-map.ts
 * @description Canonical Inngest Events type map merging all domain event schemas.
 * @layer seed
 */

import type { CoreEvents } from './core-event-map';
import type { GrowthEvents } from './growth-event-map';

export type { CoreEvents } from './core-event-map';
export type { GrowthEvents } from './growth-event-map';

export type Events = CoreEvents & GrowthEvents;
