/**
 * Check if a user is currently blocked by dunning state.
 *
 * Provides cache-busting support to ensure that users who resolve payment
 * issues and return from successful checkout redirects can immediately adjust
 * subscription settings without waiting for cache invalidation.
 *
 * Hardening resolution for Forensic Audit Architectural Risk #8.
 * @module land/billing/dunning/check-user-dunning
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { D1Database } from '@cloudflare/workers-types';

export interface CheckDunningOptions {
  /** Force bypass of dunning cache check (e.g. after verified checkout redirect) */
  bypassDunningCache?: boolean;
  /** Explicit D1 database instance */
  db?: D1Database | null;
  /** Explicit organization ID */
  orgId?: string;
}

/**
 * Determine whether a user account is actively restricted due to payment failure / dunning.
 *
 * @param userId - ID of the user
 * @param options - Cache-busting and database options
 * @returns true if user is confirmed blocked in dunning, false otherwise
 */
export async function isUserInDunning(
  userId: string,
  options?: CheckDunningOptions,
): Promise<boolean> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return false;
  }

  // Fast-path: cache-busting flag (e.g. returning from successful checkout redirect)
  if (options?.bypassDunningCache) {
    logger.info('[isUserInDunning] Bypassing dunning check via explicit cache-bust flag', { userId });
    return false;
  }

  try {
    const d1 = options?.db ?? (await getD1());
    if (!d1) return false;

    // Query current dunning state from dunning_settings
    const dunningRow = await d1
      .prepare(
        'SELECT dunning_state FROM dunning_settings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      )
      .bind(userId)
      .first<{ dunning_state: string }>();

    if (!dunningRow) {
      return false;
    }

    return dunningRow.dunning_state !== 'current';
  } catch (err: unknown) {
    logger.error('[isUserInDunning] Error checking dunning status', toError(err), { userId });
    return false;
  }
}
