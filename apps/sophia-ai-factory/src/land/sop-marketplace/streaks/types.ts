/**
 * Streak Types & Contracts
 *
 * Layer: land/sop-marketplace/streaks
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
export interface UserStreakRow {
  id: string;
  user_id: string;
  streak_type: StreakType;
  current_count: number;
  longest_count: number;
  last_activity_date: string;
  created_at: number;
  updated_at: number;
}
