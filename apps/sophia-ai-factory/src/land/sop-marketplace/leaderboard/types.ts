/**
 * Gamification Leaderboard Types
 *
 * @module land/sop-marketplace/leaderboard/types
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
export const POINTS_PER_CHALLENGE = 100;

export interface UserStreakRow {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}

export interface CompletedCountRow {
  user_id: string;
  completed_count: number;
}

export interface BadgeRow {
  badge_key: string;
}

export interface UserNameRow {
  id: string;
  display_name: string;
}
