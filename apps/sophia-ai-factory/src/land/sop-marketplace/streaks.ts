/**
 * Streak tracking for gamification — daily login and weekly video creation streaks.
 *
 * Streaks persist in the user_streaks D1 table. Each (user_id, streak_type) pair
 * has one row tracking the current count, longest count, and last activity date.
 *
 * @module land/sop-marketplace/streaks
 */

/** Supported streak types */
export type StreakType = 'login_daily' | 'video_weekly';

/** Current streak state returned by getStreakInfo() */
export interface StreakInfo {
  currentCount: number;
  longestCount: number;
  lastActivityDate: string;
}

/** Raw row from user_streaks table */
interface UserStreakRow {
  id: string;
  user_id: string;
  streak_type: StreakType;
  current_count: number;
  longest_count: number;
  last_activity_date: string;
  created_at: number;
  updated_at: number;
}

/**
 * Get the start-of-day ISO string (YYYY-MM-DD) for a timestamp.
 */
function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get the ISO week key (YYYY-ww) for a timestamp.
 * Week 01 starts on the first Monday of the year.
 */
function weekKey(ts: number): string {
  const d = new Date(ts);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-${String(week).padStart(2, '0')}`;
}

/** Fetch streak row or null */
async function getStreakRow(
  db: D1Database,
  userId: string,
  streakType: StreakType,
): Promise<UserStreakRow | null> {
  const row = await db.prepare(
    `SELECT * FROM user_streaks WHERE user_id = ?1 AND streak_type = ?2 LIMIT 1`,
  ).bind(userId, streakType).first<UserStreakRow>();
  return row ?? null;
}

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
    // First ever login — create streak with count 1
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO user_streaks (id, user_id, streak_type, current_count, longest_count, last_activity_date, created_at, updated_at)
      VALUES (?1, ?2, 'login_daily', 1, 1, ?3, ?4, ?4)
    `).bind(id, userId, today, now).run();
    return { currentCount: 1, longestCount: 1, lastActivityDate: today };
  }

  if (existing.last_activity_date === today) {
    // Already logged in today — no change
    return {
      currentCount: existing.current_count,
      longestCount: existing.longest_count,
      lastActivityDate: existing.last_activity_date,
    };
  }

  let newCount: number;
  if (existing.last_activity_date === yesterday) {
    // Consecutive day — increment
    newCount = existing.current_count + 1;
  } else {
    // Streak broken — reset
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
    // Already recorded this week — increment count within same week
    const newCount = existing.current_count + 1;
    const newLongest = Math.max(newCount, existing.longest_count);
    await db.prepare(`
      UPDATE user_streaks SET current_count = ?1, longest_count = ?2, updated_at = ?3
      WHERE user_id = ?4 AND streak_type = 'video_weekly'
    `).bind(newCount, newLongest, now, userId).run();
    return { currentCount: newCount, longestCount: newLongest, lastActivityDate: currentWeek };
  }

  // Different week — determine if consecutive
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

/**
 * Calculate a streak bonus multiplier for rewards.
 *
 * Rules:
 * - login_daily: streak >= 7 = 1.05x, >= 14 = 1.10x, >= 30 = 1.15x
 * - video_weekly: streak >= 4 = 1.10x, >= 8 = 1.15x, >= 12 = 1.20x
 *
 * Returns 1.0 (no bonus) when no streak or streak below threshold.
 */
export function calculateStreakBonus(
  streakInfo: StreakInfo | null,
  streakType: StreakType,
): number {
  if (!streakInfo) return 1.0;

  const count = streakInfo.currentCount;

  if (streakType === 'login_daily') {
    if (count >= 30) return 1.15;
    if (count >= 14) return 1.10;
    if (count >= 7) return 1.05;
  }

  if (streakType === 'video_weekly') {
    if (count >= 12) return 1.20;
    if (count >= 8) return 1.15;
    if (count >= 4) return 1.10;
  }

  return 1.0;
}

/**
 * Apply streak bonuses to a reward value.
 * Returns the bonus-multiplied value (floored) and the multiplier used.
 */
export function applyStreakBonus(
  baseValue: number,
  streakInfo: StreakInfo | null,
  streakType: StreakType,
): { boostedValue: number; multiplier: number } {
  const multiplier = calculateStreakBonus(streakInfo, streakType);
  return {
    boostedValue: Math.floor(baseValue * multiplier),
    multiplier,
  };
}
