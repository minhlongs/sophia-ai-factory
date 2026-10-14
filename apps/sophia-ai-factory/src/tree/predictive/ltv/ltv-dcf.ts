/**
 * 24-Month Discounted Cash Flow LTV Algorithm
 *
 * Layer: tree/predictive/ltv
 */

import { GATE_9_CONSTANTS } from '@/seed/types/predictive-expansion';

export function computeDiscounted24mLtv(
  currentMrrCents: number,
  churnProbability: number,
  expansionReadinessScore: number
): {
  forecastLtv24mCents: number;
  predictedMrr24mCents: number;
} {
  const mrr = Math.max(0, Math.round(currentMrrCents));
  const monthlyExpansionRate = Math.max(-0.02, Math.min(0.08, (expansionReadinessScore - 0.40) * 0.05));
  const monthlyDiscount = GATE_9_CONSTANTS.MONTHLY_DISCOUNT_RATE;

  let totalLtvCents = 0;
  let runningMrr = mrr;

  for (let month = 1; month <= 24; month++) {
    // Survival probability at month t
    const survivalRate = Math.pow(1.0 - churnProbability, month);
    // Discount factor at month t: (1 + d)^-t
    const discountFactor = Math.pow(1.0 + monthlyDiscount, -month);
    // Compound expected MRR
    runningMrr = runningMrr * (1.0 + monthlyExpansionRate);
    // Discounted cash flow
    const dcf = runningMrr * survivalRate * discountFactor;
    totalLtvCents += dcf;
  }

  const resultLtv = Math.max(0, Math.round(totalLtvCents));
  const resultMrr = Math.max(0, Math.round(runningMrr));

  return {
    forecastLtv24mCents: Number.isFinite(resultLtv) ? resultLtv : 0,
    predictedMrr24mCents: Number.isFinite(resultMrr) ? resultMrr : 0,
  };
}
