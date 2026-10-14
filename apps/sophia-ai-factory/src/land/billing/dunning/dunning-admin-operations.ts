/**
 * Dunning Admin Operations
 *
 * Admin and query operations: license suspension/restoration,
 * history retrieval, settings initialization.
 *
 * @module billing/dunning/dunning-admin-operations
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { Tier } from '@/seed/types';
import {
  DUNNING_TIER_CONFIGS,
  getDunningState,
  type DunningState,
  type DunningSettingsRow,
} from './dunning-state-machine';
import type { DunningAttemptRow } from './dunning-actions';
import {
  getDunningKvClient,
  invalidateDunningCache,
  DUNNING_CACHE_TTL_SECONDS,
} from './dunning-kv-cache';
import { suspendLicense, restoreLicense } from './dunning-license-lifecycle';

export { invalidateDunningCache, suspendLicense, restoreLicense };

/**
 * Quick API access check without full state lookup.
 */
export async function canAccessApi(licenseNonce: string): Promise<{
  allowed: boolean;
  state: DunningState;
  reason?: string;
}> {
  const kv = getDunningKvClient();
  const cacheKey = `dunning:${licenseNonce}`;

  if (kv) {
    try {
      const cached = (await kv.get(cacheKey)) as unknown as {
        allowed: boolean;
        state: DunningState;
        reason?: string;
      } | null;
      if (cached && typeof cached === 'object' && 'allowed' in cached) {
        return cached;
      }
    } catch (err) {
      logger.error('[Dunning] KV cache read error', toError(err));
    }
  }

  const stateResult = await getDunningState(licenseNonce);
  const result = { allowed: stateResult.allowed, state: stateResult.state, reason: stateResult.blockReason };

  if (kv) {
    try {
      await kv.set(
        cacheKey as unknown as Parameters<typeof kv.set>[0],
        result as unknown as Parameters<typeof kv.set>[1],
        { expirationTtl: DUNNING_CACHE_TTL_SECONDS },
      );
    } catch (err) {
      logger.error('[Dunning] KV cache write error', toError(err));
    }
  }

  return result;
}

/**
 * Get dunning attempt history for a license
 */
export async function getDunningHistory(
  licenseNonce: string,
  limit: number = 20,
): Promise<DunningAttemptRow[]> {
  const db = createServerClient();

  const { data, error } = await db
    .from('dunning_attempts')
    .select('*')
    .eq('license_nonce', licenseNonce)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('[Dunning] Failed to fetch history', toError(error));
    return [];
  }

  return data as unknown as DunningAttemptRow[];
}

/**
 * Initialize dunning settings for a new license
 */
export async function initializeDunningSettings(
  userId: string,
  licenseNonce: string,
  tier: Tier,
  stripeCustomerId?: string,
): Promise<DunningSettingsRow> {
  const db = createServerClient();
  const tierConfig = DUNNING_TIER_CONFIGS[tier];

  const { data, error } = await db
    .from('dunning_settings')
    .insert({
      user_id: userId,
      license_nonce: licenseNonce,
      stripe_customer_id: stripeCustomerId || null,
      grace_period_days: tierConfig.gracePeriodDays,
      max_retry_attempts: tierConfig.maxRetryAttempts,
      retry_schedule: tierConfig.retryIntervals.map((d) => `${d} days`),
      send_email_notifications: true,
      email_language: 'en',
      dunning_state: 'current',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to initialize dunning settings: ${error?.message}`);
  }

  logger.info('[Dunning] Settings initialized', {
    licenseNonce: licenseNonce.slice(0, 8),
    tier,
    gracePeriodDays: tierConfig.gracePeriodDays,
  });

  return data as unknown as DunningSettingsRow;
}
