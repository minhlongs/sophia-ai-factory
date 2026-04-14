/**
 * Dunning State Machine
 *
 * Manages state transitions for the dunning lifecycle:
 * current → past_due → delinquent → suspended
 *
 * Handles state reads, transitions, and grace period calculations.
 *
 * @module billing/dunning/dunning-state-machine
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

/** Dunning lifecycle states */
export type DunningState = 'current' | 'past_due' | 'delinquent' | 'suspended';

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

/** Per-tier dunning configuration */
export interface DunningTierConfig {
  gracePeriodDays: number;
  maxRetryAttempts: number;
  retryIntervals: number[];
  allowOverage: boolean;
}

/** Database row shape for dunning_settings */
export interface DunningSettingsRow {
  id: string;
  user_id: string;
  license_nonce: string;
  polar_customer_id: string | null;
  stripe_customer_id: string | null;
  grace_period_days: number;
  max_retry_attempts: number;
  retry_schedule: string[];
  send_email_notifications: boolean;
  email_language: string;
  dunning_state: DunningState;
  dunning_state_changed_at: string;
  created_at: string;
  updated_at: string;
}

/** Result of dunning state check */
export interface DunningStateResult {
  state: DunningState;
  allowed: boolean;
  gracePeriodEndsAt: Date | null;
  nextRetryAt: Date | null;
  failedPaymentCount: number;
  blockReason?: string;
}

/** Tier-specific dunning configurations */
export const DUNNING_TIER_CONFIGS: Record<Tier, DunningTierConfig> = {
  BASIC:      { gracePeriodDays: 3,  maxRetryAttempts: 3, retryIntervals: [1, 3, 7],          allowOverage: false },
  PREMIUM:    { gracePeriodDays: 5,  maxRetryAttempts: 4, retryIntervals: [1, 3, 7, 15],      allowOverage: false },
  ENTERPRISE: { gracePeriodDays: 7,  maxRetryAttempts: 5, retryIntervals: [1, 2, 5, 10, 15],  allowOverage: true  },
  MASTER:     { gracePeriodDays: 14, maxRetryAttempts: 6, retryIntervals: [1, 2, 3, 7, 14, 21], allowOverage: true },
};

// -------------------------------------------------------------------------
// State reads
// -------------------------------------------------------------------------

/**
 * Get dunning settings from database
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

    return data as DunningSettingsRow;
  } catch (error) {
    logger.error('[Dunning] Failed to get settings', error as Error);
    return null;
  }
}

/**
 * Get current dunning state with access decision
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
    ? new Date(failedAttempts[0].next_retry_at)
    : null;

  // Calculate grace period end
  let gracePeriodEndsAt: Date | null = null;
  if (settings.dunning_state === 'past_due' && settings.dunning_state_changed_at) {
    const stateChangedAt = new Date(settings.dunning_state_changed_at);
    gracePeriodEndsAt = new Date(
      stateChangedAt.getTime() + settings.grace_period_days * 24 * 60 * 60 * 1000
    );
  }

  // Determine access
  let allowed = true;
  let blockReason: string | undefined;

  if (settings.dunning_state === 'suspended') {
    allowed = false;
    blockReason = 'Account suspended due to non-payment';
  } else if (settings.dunning_state === 'delinquent') {
    allowed = false;
    blockReason = 'Account delinquent - payment required to restore access';
  } else if (settings.dunning_state === 'past_due' && gracePeriodEndsAt && gracePeriodEndsAt < new Date()) {
    allowed = false;
    blockReason = 'Grace period expired - account suspended';
  }

  return { state: settings.dunning_state, allowed, gracePeriodEndsAt, nextRetryAt, failedPaymentCount, blockReason };
}

// -------------------------------------------------------------------------
// State transitions
// -------------------------------------------------------------------------

/**
 * Transition dunning state in the database
 */
export async function transitionDunningState(
  licenseNonce: string,
  userId: string,
  newState: DunningState
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

/**
 * Calculate next retry date using exponential backoff
 */
export function calculateNextRetry(attemptNumber: number, config: DunningTierConfig): Date {
  const intervalIndex = Math.min(attemptNumber - 1, config.retryIntervals.length - 1);
  const daysUntilRetry = config.retryIntervals[intervalIndex] || 7;

  const nextRetry = new Date();
  nextRetry.setDate(nextRetry.getDate() + daysUntilRetry);
  return nextRetry;
}

/**
 * Determine new dunning state based on attempt count
 */
export function determineNewState(
  currentState: DunningState,
  attemptNumber: number,
  config: DunningTierConfig
): DunningState {
  if (currentState === 'current') return 'past_due';
  if (currentState === 'past_due' && attemptNumber >= config.maxRetryAttempts) return 'suspended';
  if (currentState === 'past_due' && attemptNumber >= Math.ceil(config.maxRetryAttempts / 2)) return 'delinquent';
  return currentState;
}
