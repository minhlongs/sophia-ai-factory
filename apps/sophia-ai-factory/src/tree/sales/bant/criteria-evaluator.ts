/**
 * BANT Criteria Factor Evaluator (Budget & Authority)
 *
 * Implements granular scoring across Budget and Authority (0-25 each).
 *
 * Layer: tree/sales/bant
 */

import type {
  BantScoreInput,
  BantFactorBreakdown,
} from '@/seed/types/enterprise-deal';
import { scoreAuthority } from './authority-evaluator';

export { scoreAuthority };

/**
 * Evaluates the Budget factor (0–25 points).
 */
export function scoreBudget(input: BantScoreInput): BantFactorBreakdown {
  let score = 0;
  let reason = '';
  const details: Record<string, unknown> = {};

  const arr = input.statedBudgetArr ?? 0;
  const mcu = input.statedMonthlyMcu ?? 0;
  const rev = (input.companyRevenueRange || '').toUpperCase();

  if (arr >= 100_000 || mcu >= 250_000) {
    score = 25;
    reason = 'Enterprise budget >= $100K ARR or >= 250K MCU/mo';
  } else if (arr >= 50_000 || mcu >= 100_000) {
    score = 20;
    reason = 'Mid-market high budget ($50K-$99K ARR or >= 100K MCU/mo)';
  } else if (arr >= 25_000 || mcu >= 50_000) {
    score = 16;
    reason = 'Established budget ($25K-$49K ARR or >= 50K MCU/mo)';
  } else if (arr >= 10_000) {
    score = 12;
    reason = 'Starter commercial budget ($10K-$24K ARR)';
  } else if (arr > 0) {
    score = 5;
    reason = 'Small pilot budget (< $10K ARR)';
  } else {
    // Inferred from revenue range if stated budget is not provided
    if (rev.includes('<1M') || rev.includes('<$1M') || rev.includes('< $1M')) {
      score = 5;
      reason = 'Startup/SMB or small budget tier (< $1M)';
    } else if (rev.includes('>50M') || rev.includes('> $50M') || rev.includes('50M+')) {
      score = 20;
      reason = 'Unstated budget; inferred from enterprise company revenue (> $50M)';
    } else if (rev.includes('10M-50M') || rev.includes('10M - 50M') || (rev.includes('50M') && !rev.includes('1M-10M'))) {
      score = 15;
      reason = 'Unstated budget; inferred from mid-market company revenue ($10M-$50M)';
    } else if (rev.includes('1M-10M') || rev.includes('1M - 10M') || rev.includes('10M') || rev.includes('1M')) {
      score = 10;
      reason = 'Unstated budget; inferred from growth company revenue ($1M-$10M)';
    } else {
      score = 5;
      reason = 'Startup/SMB or unspecified budget tier';
    }
  }

  // Bonus for verified large company revenue
  if (arr > 0 && (rev.includes('>50M') || rev.includes('> $50M') || rev.includes('50M+'))) {
    score = Math.min(25, score + 5);
    reason += ' + revenue bonus (> $50M)';
    details.revenueBonus = 5;
  } else if (arr > 0 && (rev.includes('10M-50M') || rev.includes('10M - 50M') || (rev.includes('50M') && !rev.includes('1M-10M')))) {
    score = Math.min(25, score + 3);
    reason += ' + revenue bonus ($10M-$50M)';
    details.revenueBonus = 3;
  }

  score = Math.max(0, Math.min(25, Math.round(score)));
  details.statedBudgetArr = arr;
  details.statedMonthlyMcu = mcu;
  details.companyRevenueRange = rev;

  return {
    score,
    maxScore: 25,
    factor: 'budget',
    reason,
    details,
  };
}
