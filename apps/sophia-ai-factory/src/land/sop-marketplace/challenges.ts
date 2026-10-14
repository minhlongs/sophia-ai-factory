/**
 * SOP Challenges — gamification CRUD + progress tracking
 */

import type { SopChallengeRow, UserChallengeProgressRow } from '@/seed/sop/sop-types';
import { seedInitialChallenges } from './challenges-seed';
import { claimChallengeReward } from './challenges-reward-claim';

export { seedInitialChallenges, claimChallengeReward };

export async function listActiveChallenges(db: D1Database): Promise<SopChallengeRow[]> {
  const now = Date.now();
  const { results } = await db
    .prepare(
      `SELECT * FROM sop_challenges WHERE status = 'active' AND starts_at <= ?1 AND ends_at > ?1 ORDER BY ends_at ASC`,
    )
    .bind(now)
    .all<SopChallengeRow>();
  return results;
}

export async function listAllChallenges(db: D1Database): Promise<SopChallengeRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM sop_challenges ORDER BY starts_at DESC`)
    .all<SopChallengeRow>();
  return results;
}

export async function getUserProgress(
  db: D1Database,
  userId: string,
  challengeId: string,
): Promise<UserChallengeProgressRow | null> {
  const row = await db
    .prepare(
      `SELECT * FROM user_challenge_progress WHERE user_id = ?1 AND challenge_id = ?2 LIMIT 1`,
    )
    .bind(userId, challengeId)
    .first<UserChallengeProgressRow>();
  return row ?? null;
}

export async function getUserAllProgress(
  db: D1Database,
  userId: string,
): Promise<UserChallengeProgressRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM user_challenge_progress WHERE user_id = ?1`)
    .bind(userId)
    .all<UserChallengeProgressRow>();
  return results;
}

export async function incrementProgress(
  db: D1Database,
  userId: string,
  challengeId: string,
  amount = 1,
): Promise<{ currentValue: number; completed: boolean }> {
  const now = Date.now();

  const existing = await getUserProgress(db, userId, challengeId);
  if (!existing) {
    const id = crypto.randomUUID();
    await db
      .prepare(`
      INSERT INTO user_challenge_progress (id, user_id, challenge_id, current_value, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?5)
    `)
      .bind(id, userId, challengeId, amount, now)
      .run();
  } else {
    await db
      .prepare(`
      UPDATE user_challenge_progress SET current_value = current_value + ?1, updated_at = ?2
      WHERE user_id = ?3 AND challenge_id = ?4
    `)
      .bind(amount, now, userId, challengeId)
      .run();
  }

  const progress = await getUserProgress(db, userId, challengeId);
  if (!progress) return { currentValue: 0, completed: false };

  const challenge = await db
    .prepare(`SELECT goal_value FROM sop_challenges WHERE id = ?1`)
    .bind(challengeId)
    .first<{ goal_value: number }>();

  const completed = challenge ? progress.current_value >= challenge.goal_value : false;

  if (completed && !progress.completed_at) {
    await db
      .prepare(
        `UPDATE user_challenge_progress SET completed_at = ?1, updated_at = ?1 WHERE user_id = ?2 AND challenge_id = ?3`,
      )
      .bind(now, userId, challengeId)
      .run();
  }

  return { currentValue: progress.current_value, completed };
}
