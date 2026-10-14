/**
 * Reward claim logic for SOP challenges (credits | badge | commission_boost).
 * Credit rewards benefit from a streak bonus multiplier based on the user's login streak.
 * @module land/sop-marketplace/challenges-reward-claim
 */

import type { UserChallengeProgressRow } from '@/seed/sop/sop-types';
import { addCredits } from '@/tree/mcu/credits-repo';
import { getStreakInfo, applyStreakBonus } from './streaks';

export async function claimChallengeReward(
  db: D1Database,
  userId: string,
  challengeId: string,
  rewardType: string,
  rewardValue: string,
): Promise<{ ok: boolean; reason?: string; applied: string }> {
  if (rewardType === 'credits') {
    const amount = Number(rewardValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid_amount', applied: 'none' };
    }
  } else if (rewardType !== 'badge' && rewardType !== 'commission_boost') {
    return { ok: false, reason: `unsupported_reward_type:${rewardType}`, applied: 'none' };
  }

  // Atomic conditional update eliminates TOCTOU double-spend exploits
  const now = Date.now();
  const claimRes = await db
    .prepare(
      `UPDATE user_challenge_progress
       SET reward_claimed = 1, updated_at = ?1
       WHERE user_id = ?2 AND challenge_id = ?3 AND completed_at IS NOT NULL AND reward_claimed = 0`,
    )
    .bind(now, userId, challengeId)
    .run();

  if (!claimRes.meta.changes || claimRes.meta.changes === 0) {
    const progress = await db
      .prepare(
        `SELECT * FROM user_challenge_progress WHERE user_id = ?1 AND challenge_id = ?2 LIMIT 1`,
      )
      .bind(userId, challengeId)
      .first<UserChallengeProgressRow>();
    if (!progress || !progress.completed_at) {
      return { ok: false, reason: 'not_completed', applied: 'none' };
    }
    return { ok: false, reason: 'already_claimed', applied: 'none' };
  }

  let applied = 'none';

  if (rewardType === 'credits') {
    const amount = Number(rewardValue);
    const loginStreak = await getStreakInfo(db, userId, 'login_daily');
    const { boostedValue, multiplier } = applyStreakBonus(amount, loginStreak, 'login_daily');
    await addCredits(userId, boostedValue, 'challenge_reward', {
      challengeId,
      rewardType,
      streakMultiplier: multiplier,
    });
    applied =
      multiplier > 1.0 ? `credits:${boostedValue} (streak ${multiplier}x)` : `credits:${boostedValue}`;
  } else if (rewardType === 'badge') {
    try {
      const badgeId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT OR IGNORE INTO user_badges (id, user_id, badge_key, earned_at) VALUES (?1, ?2, ?3, ?4)`,
        )
        .bind(badgeId, userId, rewardValue, Date.now())
        .run();
      applied = `badge:${rewardValue}`;
    } catch (err) {
      const { logger } = await import('@/seed/utils/logger-utility');
      logger.warn(
        '[challenge] badge insert skipped (table missing?)',
        err instanceof Error ? { error: err.message } : undefined,
      );
      applied = `badge:${rewardValue} (skipped)`;
    }
  } else if (rewardType === 'commission_boost') {
    // Boost requires affiliate profile updates — deferred to affiliate tier integration.
    applied = `commission_boost:${rewardValue} (pending)`;
  }

  return { ok: true, applied };
}
