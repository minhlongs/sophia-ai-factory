/**
 * Dunning State Machine
 *
 * Manages state reads, transitions, and access decisions for the dunning lifecycle.
 * Pure transition logic lives in dunning-transition-logic.ts.
 *
 * @module billing/dunning/dunning-state-machine
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  determineAccess,
  calculateGracePeriodEnd,
} from './dunning-transition-logic';

// Re-export types for backward compatibility
export type { DunningState, DunningTierConfig } from './dunning-transition-logic';
export { DUNNING_TIER_CONFIGS, calculateNextRetry, determineNewState } from './dunning-transition-logic';

// -------------------------------------------------------------------------
// Types (local to this module)
// -------------------------------------------------------------------------

/** Dunning event types for audit logging */
export type DunningEventType =
  | 'payment_failed'
  | 'payment_succeeded'
  | 'grace_period_started'
  | 'grace_period_ended'
  | 'suspension_started'
  | 'suspension_ended'
  | 'retry_scheduled'
  | 'retry_attempted'
  | 'state_changed';

/** Database row shape for dunning_settings */
export interface DunningSettingsRow {
  id: string;
  user_id: string;
  license_nonce: string;
  stripe_customer_id: string | null;
  grace_period_days: number;
  max_retry_attempts: number;
  retry_schedule: string[];
  send_email_notifications: boolean;
  email_language: string;
  dunning_state: import('./dunning-transition-logic').DunningState;
  dunning_state_changed_at: string;
  created_at: string;
  updated_at: string;
}

/** Result of dunning state check */
export interface DunningStateResult {
  state: import('./dunning-transition-logic').DunningState;
  allowed: boolean;
  gracePeriodEndsAt: Date | null;
  nextRetryAt: Date | null;
  failedPaymentCount: number;
  blockReason?: string;
}

// -------------------------------------------------------------------------
// State reads
// -------------------------------------------------------------------------

/**
 * Get dunning settings from database.
 */
export async function getDunningSettings(licenseNonce: string): Promise<DunningSettingsRow | null> {
  const db = createServerClient();
  try {
    const { data, error } = await db
      .from('dunning_settings')
      .select('*')
      .eq('license_nonce', licenseNonce)
      .single();

    if (error || !data) {
      logger.debug('[Dunning] No settings found', { licenseNonce: licenseNonce.slice(0, 8) });
      return null;
    }
    return data as unknown as DunningSettingsRow;
  } catch (error) {
    logger.error('[Dunning] Failed to get settings', toError(error));
    return null;
  }
}

/**
 * Get current dunning state with access decision.
 */
export async function getDunningState(licenseNonce: string): Promise<DunningStateResult> {
  const settings = await getDunningSettings(licenseNonce);

  if (!settings) {
    return { state: 'current', allowed: true, gracePeriodEndsAt: null, nextRetryAt: null, failedPaymentCount: 0 };
  }

  const db = createServerClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: failedAttempts } = await db
    .from('dunning_attempts')
    .select('next_retry_at')
    .eq('license_nonce', licenseNonce)
    .eq('success', false)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

  const failedPaymentCount = failedAttempts?.length || 0;
  const nextRetryAt = failedAttempts?.[0]?.next_retry_at
    ? new Date(failedAttempts[0].next_retry_at as string)
    : null;

  const gracePeriodEndsAt = calculateGracePeriodEnd(
    settings.dunning_state,
    settings.dunning_state_changed_at,
    settings.grace_period_days
  );

  const { allowed, blockReason } = determineAccess(settings.dunning_state, gracePeriodEndsAt);

  return { state: settings.dunning_state, allowed, gracePeriodEndsAt, nextRetryAt, failedPaymentCount, blockReason };
}

// -------------------------------------------------------------------------
// State transitions
// -------------------------------------------------------------------------

/**
 * Transition dunning state in the database.
 */
export async function transitionDunningState(
  licenseNonce: string,
  userId: string,
  newState: import('./dunning-transition-logic').DunningState
): Promise<void> {
  const currentSettings = await getDunningSettings(licenseNonce);
  const oldState = currentSettings?.dunning_state || 'current';

  if (oldState === newState) {
    logger.debug('[Dunning] State unchanged, skipping', { licenseNonce: licenseNonce.slice(0, 8), state: newState });
    return;
  }

  const db = createServerClient();
  await db.rpc('update_dunning_state', {
    p_license_nonce: licenseNonce,
    p_new_state: newState,
    p_user_id: userId,
  });

  logger.info('[Dunning] State transitioned', {
    licenseNonce: licenseNonce.slice(0, 8),
    from: oldState,
    to: newState,
  });
}
