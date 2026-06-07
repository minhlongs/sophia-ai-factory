/**
 * Dunning transition logic — pure, stateless computation.
 *
 * Contains tier configurations, state transition rules, and retry
 * scheduling. No DB access — imported by dunning-state-machine.ts.
 *
 * @module billing/dunning/dunning-transition-logic
 */

import type { Tier } from '@/seed/types';

// -------------------------------------------------------------------------
// Types (re-exported for consumers)
// -------------------------------------------------------------------------

/** Dunning lifecycle states */
export type DunningState = 'current' | 'past_due' | 'delinquent' | 'suspended';

/** Per-tier dunning configuration */
export interface DunningTierConfig {
  gracePeriodDays: number;
  maxRetryAttempts: number;
  retryIntervals: number[];
  allowOverage: boolean;
}

// -------------------------------------------------------------------------
// Tier configs
// -------------------------------------------------------------------------

/** Tier-specific dunning configurations */
export const DUNNING_TIER_CONFIGS: Record<Tier, DunningTierConfig> = {
  BASIC:      { gracePeriodDays: 3,  maxRetryAttempts: 3, retryIntervals: [1, 3, 7],             allowOverage: false },
  PREMIUM:    { gracePeriodDays: 5,  maxRetryAttempts: 4, retryIntervals: [1, 3, 7, 15],         allowOverage: false },
  ENTERPRISE: { gracePeriodDays: 7,  maxRetryAttempts: 5, retryIntervals: [1, 2, 5, 10, 15],     allowOverage: true  },
  MASTER:     { gracePeriodDays: 14, maxRetryAttempts: 6, retryIntervals: [1, 2, 3, 7, 14, 21],  allowOverage: true  },
};

// -------------------------------------------------------------------------
// Pure transition functions
// -------------------------------------------------------------------------

/**
 * Calculate next retry date using configured intervals.
 */
export function calculateNextRetry(attemptNumber: number, config: DunningTierConfig): Date {
  const intervalIndex = Math.min(attemptNumber - 1, config.retryIntervals.length - 1);
  const daysUntilRetry = config.retryIntervals[intervalIndex] || 7;
  const nextRetry = new Date();
  nextRetry.setDate(nextRetry.getDate() + daysUntilRetry);
  return nextRetry;
}

/**
 * Determine new dunning state based on current state and attempt count.
 */
export function determineNewState(
  currentState: DunningState,
  attemptNumber: number,
  config: DunningTierConfig
): DunningState {
  if (currentState === 'current') return 'past_due';
  if (currentState === 'past_due' && attemptNumber >= config.maxRetryAttempts) return 'suspended';
  if (currentState === 'past_due' && attemptNumber >= Math.ceil(config.maxRetryAttempts / 2)) return 'delinquent';
  // FIX-9A: delinquent → suspended when retries exhausted
  if (currentState === 'delinquent' && attemptNumber >= config.maxRetryAttempts) return 'suspended';
  return currentState;
}

// -------------------------------------------------------------------------
// Access decision helpers
// -------------------------------------------------------------------------

export interface AccessDecision {
  allowed: boolean;
  blockReason?: string;
}

/**
 * Determine whether a license is allowed based on dunning state and grace period.
 */
export function determineAccess(
  dunningState: DunningState,
  gracePeriodEndsAt: Date | null
): AccessDecision {
  if (dunningState === 'suspended') {
    return { allowed: false, blockReason: 'Account suspended due to non-payment' };
  }
  if (dunningState === 'delinquent') {
    return { allowed: false, blockReason: 'Account delinquent - payment required to restore access' };
  }
  if (dunningState === 'past_due' && gracePeriodEndsAt && gracePeriodEndsAt < new Date()) {
    return { allowed: false, blockReason: 'Grace period expired - account suspended' };
  }
  return { allowed: true };
}

/**
 * Calculate grace period end date from state-changed-at timestamp.
 * Returns null if not in past_due state or no timestamp available.
 */
export function calculateGracePeriodEnd(
  dunningState: DunningState,
  stateChangedAt: string | undefined,
  gracePeriodDays: number
): Date | null {
  if (dunningState !== 'past_due' || !stateChangedAt) return null;
  const changedAt = new Date(stateChangedAt);
  return new Date(changedAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
}
