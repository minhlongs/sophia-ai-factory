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
  transitionDunningState,
  type DunningState,
  type DunningStateResult,
  type DunningSettingsRow,
} from './dunning-state-machine';
import type { DunningAttemptRow } from './dunning-actions';

import {
  getDunningKvClient,
  invalidateDunningCache,
  DUNNING_CACHE_TTL_SECONDS,
} from './dunning-kv-cache';

export { invalidateDunningCache } from './dunning-kv-cache';

/**
 * Quick API access check without full state lookup.
 *
 * KV-caches the result for DUNNING_CACHE_TTL_SECONDS (5 min) because dunning
 * state changes rarely (only on payment fail/success). This avoids 2 D1 queries
 * on every API request (#R2-18 fix).
 *
 * Cache is invalidated by `invalidateDunningCache()` on state transitions.
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
      const cached = await kv.get(cacheKey) as unknown as { allowed: boolean; state: DunningState; reason?: string } | null;
      if (cached && typeof cached === 'object' && 'allowed' in cached) {
        return cached;
      }
    } catch (err) {
      logger.error('[Dunning] KV cache read error', toError(err));
      // Fall through to D1 on cache error
    }
  }

  const stateResult = await getDunningState(licenseNonce);
  const result = { allowed: stateResult.allowed, state: stateResult.state, reason: stateResult.blockReason };

  if (kv) {
    try {
      await kv.set(cacheKey as unknown as Parameters<typeof kv.set>[0], result as unknown as Parameters<typeof kv.set>[1], { expirationTtl: DUNNING_CACHE_TTL_SECONDS });
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
  limit: number = 20
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
  stripeCustomerId?: string
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
      retry_schedule: tierConfig.retryIntervals.map(d => `${d} days`),
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

/**
 * Manually suspend a license (admin action)
 */
export async function suspendLicense(
  licenseNonce: string,
  userId: string,
  reason: string
): Promise<DunningStateResult> {
  await transitionDunningState(licenseNonce, userId, 'suspended');
  // Invalidate dunning cache so next API call reads fresh suspended state
  await invalidateDunningCache(licenseNonce);

  const db = createServerClient();
  await db.from('billing_events').insert({
    user_id: userId,
    license_nonce: licenseNonce,
    event_type: 'suspension_started',
    event_category: 'dunning',
    event_data: { reason, manual: true },
  });

  logger.warn('[Dunning] License manually suspended', { licenseNonce: licenseNonce.slice(0, 8), reason });

  return getDunningState(licenseNonce);
}

/**
 * Manually restore a license (admin action)
 */
export async function restoreLicense(
  licenseNonce: string,
  userId: string,
  reason: string
): Promise<DunningStateResult> {
  await transitionDunningState(licenseNonce, userId, 'current');
  // Invalidate dunning cache so next API call reads fresh current state
  await invalidateDunningCache(licenseNonce);

  const db = createServerClient();
  await db.from('billing_events').insert({
    user_id: userId,
    license_nonce: licenseNonce,
    event_type: 'suspension_ended',
    event_category: 'dunning',
    event_data: { reason, manual: true },
  });

  logger.info('[Dunning] License manually restored', { licenseNonce: licenseNonce.slice(0, 8), reason });

  return getDunningState(licenseNonce);
}
