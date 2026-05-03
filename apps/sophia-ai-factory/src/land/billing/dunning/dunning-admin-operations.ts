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

/**
 * Quick API access check without full state lookup
 */
export async function canAccessApi(licenseNonce: string): Promise<{
  allowed: boolean;
  state: DunningState;
  reason?: string;
}> {
  const stateResult = await getDunningState(licenseNonce);
  return { allowed: stateResult.allowed, state: stateResult.state, reason: stateResult.blockReason };
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
  polarCustomerId?: string,
  stripeCustomerId?: string
): Promise<DunningSettingsRow> {
  const db = createServerClient();
  const tierConfig = DUNNING_TIER_CONFIGS[tier];

  const { data, error } = await db
    .from('dunning_settings')
    .insert({
      user_id: userId,
      license_nonce: licenseNonce,
      polar_customer_id: polarCustomerId || null,
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
