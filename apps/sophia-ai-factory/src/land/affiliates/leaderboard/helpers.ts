import { LEADERBOARD_BONUS_POOL } from '@/seed/types/affiliate-expansion-types';

/**
 * Anonymize or mask partner codes for public privacy while retaining brand prestige.
 * E.g., "PARTNER_VIETNAM_99" -> "PART***99"
 */
export function maskPartnerCode(code: string): string {
  if (!code || code.length <= 4) return code || 'ANON';
  const prefix = code.slice(0, Math.min(4, Math.floor(code.length / 2)));
  const suffix = code.slice(-2);
  return `${prefix}***${suffix}`;
}

/**
 * Assign bonus prize pool amount by rank.
 */
export function getBonusRewardForRank(rank: number): number {
  switch (rank) {
    case 1:
      return LEADERBOARD_BONUS_POOL.RANK_1_USD;
    case 2:
      return LEADERBOARD_BONUS_POOL.RANK_2_USD;
    case 3:
      return LEADERBOARD_BONUS_POOL.RANK_3_USD;
    default:
      return 0;
  }
}

/**
 * Format current or provided date to "YYYY-MM" month period string.
 */
export function getCurrentMonthPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Get start and end timestamp (epoch ms) for a given "YYYY-MM" period.
 */
export function getPeriodTimestampRange(period: string): { startMs: number; endMs: number } {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  return {
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
  };
}
