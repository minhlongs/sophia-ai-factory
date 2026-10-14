/**
 * Unified Inngest Functions Manifest
 *
 * Layer: app/api/inngest/serve
 */

import { CORE_INNGEST_FUNCTIONS } from "./core-functions";
import { GROWTH_INNGEST_FUNCTIONS } from "./growth-functions";

export * from "./core-functions";
export * from "./growth-functions";

export const ALL_INNGEST_FUNCTIONS = [
  ...CORE_INNGEST_FUNCTIONS,
  ...GROWTH_INNGEST_FUNCTIONS,
];
