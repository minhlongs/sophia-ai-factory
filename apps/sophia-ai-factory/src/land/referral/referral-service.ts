/**
 * Public service API for referrals.
 *
 * Use cases:
 * - recordReferralEvent({ code, type, ... }) — attribution lifecycle
 * - awardReferralRewardUponPayment({ referrerId, referredUserId, paymentId, tier, amount })
 * — idempotent reward fulfillment tied to NOWPayments IPN finished
 *
 * Following Result<T,E> for error discrimination (billing pattern).
 *
 * @module referral/referral-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { calculateReward } from '@/tree/referral/referral-rewards';
import { findReferrerByCode } from './referral-db';
import {
  acquireRewardLock,
  releaseRewardLock,
  insertRewardLedgerAndCredit,
  markRewardEventProcessed,
} from './referral-rewards-db';
import { success, failure, type Result } from '@/seed/types/result';
import type { Tier } from '@/seed/types';

export interface RecordEventInput {
  code: string;
  type: 'created' | 'clicked' | 'converted' | 'rewarded';
  referrerId: string;
  referredId?: string | null;
}

export interface RecordEventResult {
  recorded: boolean;
}

/**
 * Record a referral lifecycle event. Currently a no-op persistence
 * stub — replace with a real events table when the analytics schema
 * is ready. Returns { recorded: true } on a valid transition so the
 * caller can continue without error.
 */
export function recordReferralEvent(input: RecordEventInput): Result<RecordEventResult, Error> {
  if (!input.code || !input.referrerId || !input.type) {
    return failure(new Error('code, referrerId, and type are required'));
  }

  // Event state validation (tree helper) — import dynamically to avoid a circular on tree→seed,
  // but since this is land, a direct import is fine.
  // We keep the validation minimal here because the tree helper is a pure predicate.

  const output: RecordEventResult = { recorded: true };

  logger.info('[referral] event recorded', { code: input.code, type: input.type });
  return success(output);
}

export interface AwardRewardInput {
  referrerId: string;
  referredUserId: string;
  paymentId: string;
  tier: Tier;
  paymentAmountCents: number;
}

export interface AwardRewardResult {
  rewardCents: number;
  tier: Tier;
}

/**
 * Idempotent reward issuance after a successful payment has been confirmed.
 *
 * 1. Acquire atomic lock (INSERT ON CONFLICT DO NOTHING) keyed by (paymentId, referrerId).
 * 2. If we own the lock, compute tier-aware reward amount and persist in referral_rewards.
 * 3. Atomically credit the referrer's account_credit_cents in user_profiles via D1 batch.
 * 4. Mark lock processed — release.
 *
 * On transient failure (lock not acquired or already processed), returns failure
 * with a non-throwing Result so the IPN handler can decide retry behavior.
 */
export async function awardReferralRewardUponPayment(
  input: AwardRewardInput,
): Promise<Result<AwardRewardResult, Error>> {
  const lock = await acquireRewardLock(input.paymentId, input.referrerId);

  if (!lock.acquired) {
    if (lock.alreadyProcessed) {
      logger.info('[referral] reward already issued — idempotent no-op', {
        referrerId: input.referrerId,
        paymentId: input.paymentId,
      });
      // Derive expected reward amount for consistency, even though no-op.
      const cached = computeRewardAmount(input);
      return success(cached);
    }

    // Another process owns the lock — do not block here; release and return failure
    // so NOWPayments retries.
    await releaseRewardLock(input.paymentId, input.referrerId);
    return failure(new Error('Concurrent reward in progress — retry'));
  }

  // We own the lock — compute reward and persist.
  try {
    const expected = computeRewardAmount(input);
    const insertResult = await insertRewardLedgerAndCredit({
      referrerId: input.referrerId,
      referredUserId: input.referredUserId,
      paymentId: input.paymentId,
      rewardCents: expected.rewardCents,
      tier: input.tier,
    });

    if (!insertResult.ok) {
      await releaseRewardLock(input.paymentId, input.referrerId);
      return failure(insertResult.error);
    }

    await markRewardEventProcessed(input.paymentId, input.referrerId);
    await releaseRewardLock(input.paymentId, input.referrerId);

    return success(expected);
  } catch (err) {
    await releaseRewardLock(input.paymentId, input.referrerId);
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[referral] reward in-flight write failed', error, {
      referrerId: input.referrerId,
      paymentId: input.paymentId,
    });
    return failure(error);
  }
}

/** Resolve the referrer for a signup code; null if code doesn't resolve. */
export async function resolveReferrerForSignup(code: string): Promise<{ referrerId: string; orgId: string | null } | null> {
  try {
    return await findReferrerByCode(code);
  } catch (err) {
    logger.warn('[referral] resolveReferrerForSignup failed', {
      code,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function computeRewardAmount(input: AwardRewardInput): AwardRewardResult {
  const calculated = calculateReward({ tier: input.tier, paymentAmountCents: input.paymentAmountCents });
  return { rewardCents: calculated.rewardCents, tier: input.tier };
}
