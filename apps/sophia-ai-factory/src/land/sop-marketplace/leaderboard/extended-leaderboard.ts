/**
 * Extended Leaderboard Aggregation
 *
 * @module land/sop-marketplace/leaderboard/extended-leaderboard
 */

import type {
  LeaderboardEntryV2,
  CompletedCountRow,
  UserNameRow,
} from './types';
import { POINTS_PER_CHALLENGE } from './types';
import { getUserStreak } from './streaks';
import { getUserBadges } from './badges';

/**
 * Fetch display names for a set of user IDs from the Better Auth users table.
 */
async function fetchUserNames(
  db: D1Database,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const placeholders = userIds.map((_, i) => `?${i + 1}`).join(', ');
  const { results } = await db.prepare(
    `SELECT id, COALESCE(name, email, id) AS display_name
     FROM "user"
     WHERE id IN (${placeholders})`,
  ).bind(...userIds).all<UserNameRow>();

  const map = new Map<string, string>();
  for (const row of results ?? []) {
    map.set(row.id, row.display_name);
  }
  return map;
}

/**
 * Fetch the gamification leaderboard with streaks, badges, and points.
 * Users are ranked by completed challenge count descending.
 * @param db - D1 database binding
 * @param limit - max entries to return (1–200, default 50)
 */
export async function getExtendedLeaderboard(
  db: D1Database,
  limit?: number,
): Promise<LeaderboardEntryV2[]> {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit ?? 50)));

  const { results: completionResults } = await db.prepare(
    `SELECT user_id, COUNT(*) AS completed_count
     FROM user_challenge_progress
     WHERE completed_at IS NOT NULL
     GROUP BY user_id
     ORDER BY completed_count DESC
     LIMIT ?1`,
  ).bind(safeLimit).all<CompletedCountRow>();

  if (completionResults.length === 0) return [];

  const userIds = completionResults.map((r) => r.user_id);
  const nameMap = await fetchUserNames(db, userIds);

  const entries: LeaderboardEntryV2[] = [];
  for (let i = 0; i < completionResults.length; i++) {
    const row = completionResults[i];
    const userId = row.user_id;
    const completedChallenges = Number(row.completed_count);

    const [streak, badges] = await Promise.all([
      getUserStreak(db, userId),
      getUserBadges(db, userId),
    ]);

    entries.push({
      rank: i + 1,
      userId,
      displayName: nameMap.get(userId) ?? userId,
      totalPoints: completedChallenges * POINTS_PER_CHALLENGE,
      completedChallenges,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      badges,
    });
  }

  return entries;
}
