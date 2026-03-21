/**
 * Affiliate program scorer
 *
 * Score formula (0-100):
 *   commission_rate * 0.4 + cookie_factor * 0.3 + reliability * 0.3
 *
 * - commission_rate: normalize to 0-100 (cap at 50% = 100 pts)
 * - cookie_factor: normalize days (cap at 90d = 100 pts)
 * - reliability: based on payout_threshold + payout_frequency
 */

import type { AffiliateProgram, RawProgram } from '@/types/affiliate';

export const TOP_PROGRAMS_THRESHOLD = 60;

// Max commission rate used for normalization (50% = 100 pts)
const MAX_COMMISSION_RATE = 50;
// Max cookie days used for normalization (90d = 100 pts)
const MAX_COOKIE_DAYS = 90;

/**
 * Compute reliability score (0-100) from payout threshold + frequency.
 *
 * Low threshold + monthly = most reliable = 100
 * High threshold + quarterly = least reliable = ~20
 */
function computeReliability(payout_threshold: number, payout_frequency: string): number {
  // Threshold score: lower is better (< $50 = 100, $50-$100 = 70, $100-$500 = 40, > $500 = 10)
  let thresholdScore: number;
  if (payout_threshold < 50) thresholdScore = 100;
  else if (payout_threshold < 100) thresholdScore = 70;
  else if (payout_threshold < 500) thresholdScore = 40;
  else thresholdScore = 10;

  // Frequency score: monthly = 100, weekly = 90, quarterly = 50, annual = 20
  const freqScores: Record<string, number> = {
    weekly: 90,
    monthly: 100,
    quarterly: 50,
    annual: 20,
  };
  const freqScore = freqScores[payout_frequency.toLowerCase()] ?? 60;

  return Math.round((thresholdScore + freqScore) / 2);
}

/**
 * Score a raw or existing program. Returns 0–100.
 */
export function scoreProgram(program: Pick<
  RawProgram | AffiliateProgram,
  'commission_rate' | 'cookie_duration_days' | 'payout_threshold' | 'payout_frequency'
>): number {
  // Normalize commission_rate (percentage 0-50+ → 0-100)
  const commissionNorm = Math.min(program.commission_rate / MAX_COMMISSION_RATE, 1) * 100;

  // Normalize cookie duration (days 0-90+ → 0-100)
  const cookieNorm = Math.min(program.cookie_duration_days / MAX_COOKIE_DAYS, 1) * 100;

  // Reliability from payout terms
  const reliability = computeReliability(program.payout_threshold, program.payout_frequency);

  const score = commissionNorm * 0.4 + cookieNorm * 0.3 + reliability * 0.3;

  return Math.round(Math.min(score, 100));
}

/**
 * Rank programs by score descending, returns new array.
 */
export function rankPrograms<T extends { score: number }>(programs: T[]): T[] {
  return [...programs].sort((a, b) => b.score - a.score);
}
