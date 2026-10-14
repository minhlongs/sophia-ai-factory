/**
 * Streak Mutators & Queries
 *
 * Layer: land/sop-marketplace/streaks
 */

import type { StreakInfo, StreakType } from './types';
import { dateKey, getStreakRow, weekKey } from './streak-db';

/**
 * Update daily login streak.
 *
 * - If last activity is today: no change (already logged in today).
 * - If last activity is yesterday: increment streak.
 * - If last activity is older: reset streak to 1.
 * Returns the updated streak info.
 */
export async function updateLoginStreak(
  db: D1Database,
  userId: string,
): Promise<StreakInfo> {
  const today = dateKey(Date.now());
  const yesterday = dateKey(Date.now() - 86400000);
  const now = Date.now();

  const existing = await getStreakRow(db, userId, 'login_daily');

  if (!existing) {
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO user_streaks (id, user_id, streak_type, current_count, longest_count, last_activity_date, created_at, updated_at)
      VALUES (?1, ?2, 'login_daily', 1, 1, ?3, ?4, ?4)
    `).bind(id, userId, today, now).run();
    return { currentCount: 1, longestCount: 1, lastActivityDate: today };
  }

  if (existing.last_activity_date === today) {
    return {
      currentCount: existing.current_count,
      longestCount: existing.longest_count,
      lastActivityDate: existing.last_activity_date,
    };
  }

  let newCount: number;
  if (existing.last_activity_date === yesterday) {
    newCount = existing.current_count + 1;
  } else {
    newCount = 1;
  }

  const newLongest = Math.max(newCount, existing.longest_count);

  await db.prepare(`
    UPDATE user_streaks SET current_count = ?1, longest_count = ?2, last_activity_date = ?3, updated_at = ?4
    WHERE user_id = ?5 AND streak_type = 'login_daily'
  `).bind(newCount, newLongest, today, now, userId).run();

  return { currentCount: newCount, longestCount: newLongest, lastActivityDate: today };
}

/**
 * Update weekly video creation streak.
 *
 * - If last activity is this week: increment streak.
 * - If last activity was last week: increment weekly count.
 * - If last activity is older (gap > 1 week): reset to 1.
 * Returns the updated streak info.
 */
export async function updateVideoStreak(
  db: D1Database,
  userId: string,
): Promise<StreakInfo> {
  const currentWeek = weekKey(Date.now());
  const now = Date.now();

  const existing = await getStreakRow(db, userId, 'video_weekly');

  if (!existing) {
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO user_streaks (id, user_id, streak_type, current_count, longest_count, last_activity_date, created_at, updated_at)
      VALUES (?1, ?2, 'video_weekly', 1, 1, ?3, ?4, ?4)
    `).bind(id, userId, currentWeek, now).run();
    return { currentCount: 1, longestCount: 1, lastActivityDate: currentWeek };
  }

  if (existing.last_activity_date === currentWeek) {
    const newCount = existing.current_count + 1;
    const newLongest = Math.max(newCount, existing.longest_count);
    await db.prepare(`
      UPDATE user_streaks SET current_count = ?1, longest_count = ?2, updated_at = ?3
      WHERE user_id = ?4 AND streak_type = 'video_weekly'
    `).bind(newCount, newLongest, now, userId).run();
    return { currentCount: newCount, longestCount: newLongest, lastActivityDate: currentWeek };
  }

  const lastWeekNum = Number(existing.last_activity_date.split('-')[1]);
  const thisWeekNum = Number(currentWeek.split('-')[1]);
  const yearMatch = existing.last_activity_date.split('-')[0] === currentWeek.split('-')[0];
  const isConsecutive = yearMatch && thisWeekNum - lastWeekNum === 1;

  const newCount = isConsecutive ? existing.current_count + 1 : 1;
  const newLongest = Math.max(newCount, existing.longest_count);

  await db.prepare(`
    UPDATE user_streaks SET current_count = ?1, longest_count = ?2, last_activity_date = ?3, updated_at = ?4
    WHERE user_id = ?5 AND streak_type = 'video_weekly'
  `).bind(newCount, newLongest, currentWeek, now, userId).run();

  return { currentCount: newCount, longestCount: newLongest, lastActivityDate: currentWeek };
}

/**
 * Get current streak info for a user and streak type.
 * Returns null when no streak data exists yet.
 */
export async function getStreakInfo(
  db: D1Database,
  userId: string,
  streakType: StreakType,
): Promise<StreakInfo | null> {
  const row = await getStreakRow(db, userId, streakType);
  if (!row) return null;
  return {
    currentCount: row.current_count,
    longestCount: row.longest_count,
    lastActivityDate: row.last_activity_date,
  };
}
