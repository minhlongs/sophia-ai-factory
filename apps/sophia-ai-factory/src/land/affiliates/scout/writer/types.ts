/**
 * Affiliate Scout Writer Types
 *
 * @module land/affiliates/scout/writer/types
 */

import type { ScoutResult } from '../types';

export interface ScoutRunResult {
  discovered: number;
  errors: ScoutResult[];
}
