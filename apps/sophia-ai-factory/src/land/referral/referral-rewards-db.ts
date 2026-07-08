/**
 * Referral reward ledger mutations.
 *
 * Mirrors `affiliates/commission-ledger-mutations.ts`: INSERT ON CONFLICT DO NOTHING
 * atomic lock + D1 batch for atomic ledger insert + credit increment.
 *
 * @module referral/referral-rewards-db
 */

import { getD1, createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { Tier } from '@/seed/types';

export interface RewardLock {
  acquired: boolean;
  alreadyProcessed: boolean;
}

/**
 * Acquire an atomic lock for a (paymentId, referrerId) reward attempt.
 */
export async function acquireRewardLock(paymentId: string, referrerId: string): Promise<RewardLock> {
  const d1 = getD1();
  if (!d1) {
    logger.error('[referral-rewards] D1 binding not available');
    return { acquired: false, alreadyProcessed: false };
  }

  const eventId = `referral_reward_${paymentId}_${referrerId}`;

  try {
    const lockResult = await d1
      .prepare(
        `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
         VALUES (?1, ?2, ?3, 0, ?4)
         ON CONFLICT(event_id) DO NOTHING`,
      )
      .bind(eventId, 'referral.reward', JSON.stringify({ paymentId, referrerId }), new Date().toISOString())
      .run();

    if (!lockResult.meta?.changes) {
      const existing = await d1
        .prepare('SELECT processed FROM payment_events WHERE event_id = ?1')
        .bind(eventId)
        .first<{ processed: number | boolean }>();

      if (!existing) return { acquired: false, alreadyProcessed: false };
      if (existing.processed === 1) return { acquired: false, alreadyProcessed: true };
      return { acquired: false, alreadyProcessed: false };
    }

    return { acquired: true, alreadyProcessed: false };
  } catch (err) {
    logger.error('[referral-rewards] Lock acquisition failed', {
      error: err instanceof Error ? err.message : String(err),
      paymentId,
      referrerId,
    });
    return { acquired: false, alreadyProcessed: false };
  }
}

export async function markRewardEventProcessed(paymentId: string, referrerId: string): Promise<void> {
  const d1 = getD1();
  if (!d1) return;

  try {
    const eventId = `referral_reward_${paymentId}_${referrerId}`;
    await d1
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run();
  } catch (err) {
    logger.warn('[referral-rewards] Failed to mark event processed', {
      error: err instanceof Error ? err.message : String(err),
      paymentId,
      referrerId,
    });
  }
}

export async function releaseRewardLock(paymentId: string, referrerId: string): Promise<void> {
  const d1 = getD1();
  if (!d1) return;

  try {
    const eventId = `referral_reward_${paymentId}_${referrerId}`;
    await d1
      .prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0')
      .bind(eventId)
      .run();
  } catch (err) {
    logger.warn('[referral-rewards] Failed to release lock', {
      error: err instanceof Error ? err.message : String(err),
      paymentId,
      referrerId,
    });
  }
}

/**
 * Idempotent insert into referral_rewards (UNIQUE(payment_id, referrer_id) protects us).
 * Also increments account_credit_cents in user_profiles atomically via D1 batch.
 */
export async function insertRewardLedgerAndCredit({
  referrerId,
  referredUserId,
  paymentId,
  rewardCents,
  tier,
}: {
  referrerId: string;
  referredUserId: string;
  paymentId: string;
  rewardCents: number;
  tier: Tier;
}): Promise<Result<void, Error>> {
  const d1 = getD1();
  if (!d1) return failure(new Error('D1 binding not available'));

  try {
    const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 32);
    const now = new Date().toISOString();

    // Double-check uniqueness (belt-and-suspenders in case D1 UNIQUE fires)
    const exists = await d1
      .prepare('SELECT id FROM referral_rewards WHERE payment_id = ?1 AND referrer_id = ?2')
      .bind(paymentId, referrerId)
      .first<{ id: string }>();

    if (exists) {
      logger.info('[referral-rewards] Duplicate reward suppressed', { paymentId, referrerId });
      return success(undefined);
    }

    await d1.batch([
      d1.prepare(
        `INSERT INTO referral_rewards (id, referrer_id, referred_user_id, payment_id, reward_cents, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(id, referrerId, referredUserId, paymentId, rewardCents, now),
      d1.prepare(
        `UPDATE user_profiles
         SET settings = json_set(
           COALESCE(settings, '{}'),
           '$.account_credit_cents',
           CAST(COALESCE(json_extract(settings, '$.account_credit_cents'), '0') AS INTEGER) + ?1
         ),
         settings = json_set(settings, '$.last_referral_reward_at', ?2)
         WHERE user_id = ?3`,
      ).bind(rewardCents, now, referrerId),
    ]);

    logger.info('[referral-rewards] Reward credited', {
      referrerId,
      referredUserId,
      paymentId,
      rewardCents,
      tier,
    });

    return success(undefined);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[referral-rewards] insertRewardLedgerAndCredit failed', error, {
      referrerId,
      referredUserId,
      paymentId,
      rewardCents,
    });
    return failure(error);
  }
}
