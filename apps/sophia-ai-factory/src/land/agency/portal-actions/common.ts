/**
 * Common Types and Helpers for Agency Portal Server Actions
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/common
 */

import { getD1Sync } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';

export interface StepValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Resolves active D1 database binding or fallback override.
 */
export function resolveDb(dbOverride?: unknown): D1Database {
  if (dbOverride && typeof (dbOverride as D1Database).prepare === 'function') {
    return dbOverride as D1Database;
  }
  return getD1Sync();
}
