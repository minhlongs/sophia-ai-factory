/**
 * Gamification User Badges Retrieval
 *
 * @module land/sop-marketplace/leaderboard/badges
 */

import type { BadgeRow } from './types';

/**
 * Get all badges earned by a user.
 * Returns empty array if the user_badges table does not exist or has no records.
 */
export async function getUserBadges(
  db: D1Database,
  userId: string,
): Promise<string[]> {
  try {
    const { results } = await db.prepare(
      `SELECT badge_key FROM user_badges WHERE user_id = ?1 ORDER BY earned_at ASC`,
    ).bind(userId).all<BadgeRow>();

    return (results ?? []).map((r) => r.badge_key);
  } catch {
    // user_badges table may not exist yet
    return [];
  }
}
