/**
 * Gamification User Streaks Operations
 *
 * @module land/sop-marketplace/leaderboard/streaks
 */

import type { UserStreakRow } from './types';

/**
 * Get the current and longest streak for a user.
 * Returns zeroes if no streak record exists yet.
 */
export async function getUserStreak(
  db: D1Database,
  userId: string,
): Promise<{ current: number; longest: number }> {
  try {
    const row = await db.prepare(
      `SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = ?1 LIMIT 1`,
    ).bind(userId).first<UserStreakRow>();

    if (!row) return { current: 0, longest: 0 };
    return {
      current: row.current_streak,
      longest: row.longest_streak,
    };
  } catch {
    // user_streaks table may not exist yet
    return { current: 0, longest: 0 };
  }
}

/**
 * Update streak for a user on daily activity.
 *
 * - Table is created on first use (CREATE TABLE IF NOT EXISTS).
 * - If last activity was yesterday: increment current streak.
 * - If last activity was today: no change (already counted).
 * - If last activity was >1 day ago: reset to 1.
 * - No prior record: start at 1.
 */
export async function updateStreak(
  db: D1Database,
  userId: string,
): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS user_streaks (
      user_id TEXT PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_activity_date TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0
    )`,
  ).run();

  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const now = Date.now();

  const existing = await db.prepare(
    `SELECT current_streak, longest_streak, last_activity_date
     FROM user_streaks WHERE user_id = ?1 LIMIT 1`,
  ).bind(userId).first<UserStreakRow>();

  if (!existing) {
    // First activity ever — start streak at 1
    await db.prepare(
      `INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, updated_at)
       VALUES (?1, 1, 1, ?2, ?3)`,
    ).bind(userId, today, now).run();
    return;
  }

  if (existing.last_activity_date === today) {
    // Already counted today — no change
    return;
  }

  const newCurrent = existing.last_activity_date === yesterdayDate
    ? existing.current_streak + 1
    : 1;

  const newLongest = Math.max(newCurrent, existing.longest_streak);

  await db.prepare(
    `UPDATE user_streaks SET current_streak = ?1, longest_streak = ?2,
     last_activity_date = ?3, updated_at = ?4
     WHERE user_id = ?5`,
  ).bind(newCurrent, newLongest, today, now, userId).run();
}
