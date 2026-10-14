/**
 * Streak Bonus Calculations
 *
 * Layer: land/sop-marketplace/streaks
 */

import type { StreakInfo, StreakType } from './types';

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
