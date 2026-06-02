/**
 * SOP Challenges — gamification CRUD + progress tracking
 */

import type { SopChallengeRow, UserChallengeProgressRow } from '@/tree/sop/sop-types';
import { addCredits } from '@/land/mcu/credits-repo';

/** Claim a completed challenge reward. Supports: 'credits' | 'badge' | 'commission_boost'. */
export async function claimChallengeReward(
  db: D1Database,
  userId: string,
  challengeId: string,
  rewardType: string,
  rewardValue: string,
): Promise<{ ok: boolean; reason?: string; applied: string }> {
  // Verify user actually completed the challenge
  const progress = await getUserProgress(db, userId, challengeId);
  if (!progress || !progress.completed_at) {
    return { ok: false, reason: 'not_completed', applied: 'none' };
  }

  if (progress.reward_claimed) {
    return { ok: false, reason: 'already_claimed', applied: 'none' };
  }

  let applied = 'none';

  if (rewardType === 'credits') {
    const amount = Number(rewardValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid_amount', applied: 'none' };
    }
    await addCredits(userId, amount, 'challenge_reward', { challengeId, rewardType });
    applied = `credits:${amount}`;
  } else if (rewardType === 'badge') {
    // Best-effort: upsert badge into user_badges table if it exists
    try {
      const badgeId = crypto.randomUUID();
      await db.prepare(
        `INSERT OR IGNORE INTO user_badges (id, user_id, badge_key, earned_at) VALUES (?1, ?2, ?3, ?4)`,
      )
        .bind(badgeId, userId, rewardValue, Date.now())
        .run();
      applied = `badge:${rewardValue}`;
    } catch (err) {
      // Table may not exist yet — log but don't fail the whole claim
      console.warn('[challenge] badge insert skipped (table missing?)', err);
      applied = `badge:${rewardValue} (skipped)`;
    }
  } else if (rewardType === 'commission_boost') {
    // Commission boost requires affiliate profile updates — deferred to affiliate tier integration.
    // Mark the claim record but do NOT apply boost yet.
    applied = `commission_boost:${rewardValue} (pending)`;
  } else {
    return { ok: false, reason: `unsupported_reward_type:${rewardType}`, applied: 'none' };
  }

  // Mark reward as claimed
  const now = Date.now();
  await db.prepare(
    `UPDATE user_challenge_progress SET reward_claimed = 1, updated_at = ?1 WHERE user_id = ?2 AND challenge_id = ?3`,
  ).bind(now, userId, challengeId).run();

  return { ok: true, applied };
}

export async function listActiveChallenges(db: D1Database): Promise<SopChallengeRow[]> {
  const now = Date.now();
  const { results } = await db.prepare(
    `SELECT * FROM sop_challenges WHERE status = 'active' AND starts_at <= ?1 AND ends_at > ?1 ORDER BY ends_at ASC`
  ).bind(now).all<SopChallengeRow>();
  return results;
}

export async function listAllChallenges(db: D1Database): Promise<SopChallengeRow[]> {
  const { results } = await db.prepare(
    `SELECT * FROM sop_challenges ORDER BY starts_at DESC`
  ).all<SopChallengeRow>();
  return results;
}

export async function getUserProgress(
  db: D1Database, userId: string, challengeId: string
): Promise<UserChallengeProgressRow | null> {
  const row = await db.prepare(
    `SELECT * FROM user_challenge_progress WHERE user_id = ?1 AND challenge_id = ?2 LIMIT 1`
  ).bind(userId, challengeId).first<UserChallengeProgressRow>();
  return row ?? null;
}

export async function getUserAllProgress(
  db: D1Database, userId: string
): Promise<UserChallengeProgressRow[]> {
  const { results } = await db.prepare(
    `SELECT * FROM user_challenge_progress WHERE user_id = ?1`
  ).bind(userId).all<UserChallengeProgressRow>();
  return results;
}

export async function incrementProgress(
  db: D1Database, userId: string, challengeId: string, amount = 1
): Promise<{ currentValue: number; completed: boolean }> {
  const now = Date.now();

  // Upsert progress row
  const existing = await getUserProgress(db, userId, challengeId);
  if (!existing) {
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO user_challenge_progress (id, user_id, challenge_id, current_value, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?5)
    `).bind(id, userId, challengeId, amount, now).run();
  } else {
    await db.prepare(`
      UPDATE user_challenge_progress SET current_value = current_value + ?1, updated_at = ?2
      WHERE user_id = ?3 AND challenge_id = ?4
    `).bind(amount, now, userId, challengeId).run();
  }

  // Check completion against goal
  const progress = await getUserProgress(db, userId, challengeId);
  if (!progress) return { currentValue: 0, completed: false };

  const challenge = await db.prepare(`SELECT goal_value FROM sop_challenges WHERE id = ?1`)
    .bind(challengeId).first<{ goal_value: number }>();

  const completed = challenge ? progress.current_value >= challenge.goal_value : false;

  if (completed && !progress.completed_at) {
    await db.prepare(
      `UPDATE user_challenge_progress SET completed_at = ?1, updated_at = ?1 WHERE user_id = ?2 AND challenge_id = ?3`
    ).bind(now, userId, challengeId).run();
  }

  return { currentValue: progress.current_value, completed };
}

/** Seed initial challenges (INSERT OR IGNORE — safe to call repeatedly) */
export async function seedInitialChallenges(db: D1Database): Promise<void> {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const challenges = [
    {
      id: 'challenge-ship-10-videos',
      title_en: 'Ship 10 Videos',
      title_vi: 'Tạo 10 Video',
      description_en: 'Run 10 SOP executions in 30 days',
      description_vi: 'Chạy 10 SOP trong 30 ngày',
      goal_type: 'sop_runs',
      goal_value: 10,
      reward_type: 'badge',
      reward_value: 'video-producer',
    },
    {
      id: 'challenge-first-sale',
      title_en: 'First SOP Sale',
      title_vi: 'Bán SOP đầu tiên',
      description_en: 'Sell your first community SOP on the marketplace',
      description_vi: 'Bán SOP cộng đồng đầu tiên trên marketplace',
      goal_type: 'sop_sales',
      goal_value: 1,
      reward_type: 'credits',
      reward_value: '50',
    },
    {
      id: 'challenge-earn-100',
      title_en: 'Earn $100 Commission',
      title_vi: 'Kiếm $100 hoa hồng',
      description_en: 'Earn $100 in total affiliate + SOP commission',
      description_vi: 'Kiếm tổng cộng $100 hoa hồng affiliate + SOP',
      goal_type: 'commission_earned',
      goal_value: 10000,
      reward_type: 'commission_boost',
      reward_value: '1.1x',
    },
  ];

  for (const c of challenges) {
    await db.prepare(`
      INSERT OR IGNORE INTO sop_challenges
        (id, title_en, title_vi, description_en, description_vi, goal_type, goal_value, reward_type, reward_value, starts_at, ends_at, status, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'active', ?10)
    `).bind(
      c.id, c.title_en, c.title_vi, c.description_en, c.description_vi,
      c.goal_type, c.goal_value, c.reward_type, c.reward_value,
      now, now + thirtyDays
    ).run();
  }
}
