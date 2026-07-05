/**
 * Extended gamification leaderboard — challenges v2.
 *
 * Adds streak tracking, badge retrieval, and a unified leaderboard
 * that ranks users by completed challenges with gamification metadata.
 *
 * Streak data persists in `user_streaks` D1 table (created on first use).
 * Badge data reads from `user_badges` table (inserted by claimChallengeReward).
 *
 * @module land/sop-marketplace/leaderboard-ext
 */

export interface LeaderboardEntryV2 {
  rank: number;
  userId: string;
  displayName: string;
  totalPoints: number;
  completedChallenges: number;
  currentStreak: number;
  longestStreak: number;
  badges: string[];
}

/** Base points awarded per completed challenge */
const POINTS_PER_CHALLENGE = 100;

interface UserStreakRow {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}

interface CompletedCountRow {
  user_id: string;
  completed_count: number;
}

interface BadgeRow {
  badge_key: string;
}

interface UserNameRow {
  id: string;
  display_name: string;
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
