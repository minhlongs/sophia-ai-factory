/**
 * Streak Date Utilities and Database Operations
 *
 * Layer: land/sop-marketplace/streaks
 */

import type { StreakType, UserStreakRow } from './types';

/**
 * Get the start-of-day ISO string (YYYY-MM-DD) for a timestamp.
 */
export function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get the ISO week key (YYYY-ww) for a timestamp.
 * Week 01 starts on the first Monday of the year.
 */
export function weekKey(ts: number): string {
  const d = new Date(ts);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-${String(week).padStart(2, '0')}`;
}

/** Fetch streak row or null */
export async function getStreakRow(
  db: D1Database,
  userId: string,
  streakType: StreakType,
): Promise<UserStreakRow | null> {
  const row = await db.prepare(
    `SELECT * FROM user_streaks WHERE user_id = ?1 AND streak_type = ?2 LIMIT 1`,
  ).bind(userId, streakType).first<UserStreakRow>();
  return row ?? null;
}
