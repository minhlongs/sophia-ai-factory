/**
 * @module land/affiliates/scout/scoring/scoring-engine
 * Composite affiliate quality scoring engine.
 */

import type { Affiliate } from '../types';
import {
  type ScoringWeights,
  type ScoringContext,
  type ScoredAffiliate,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLD,
  DEFAULT_COOKIE_DAYS,
  DEFAULT_PAYOUT_FREQUENCY,
  DEFAULT_PROGRAM_AGE_MONTHS,
  DEFAULT_APPROVAL_RATE,
} from './types';
import {
  scoreCommission,
  scoreCookieDuration,
  scorePayoutSpeed,
  scoreProgramAge,
  scoreEpc,
} from './epc-calculator';
import { evaluateRisk } from './risk-evaluator';

/**
 * Compute a composite quality score for an affiliate offer.
 */
export function scoreAffiliate(
  affiliate: Affiliate,
  ctx?: ScoringContext,
): ScoredAffiliate {
  const weights: ScoringWeights = { ...DEFAULT_WEIGHTS, ...ctx?.weights };
  const threshold = ctx?.threshold ?? DEFAULT_THRESHOLD;

  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  const normWeights: ScoringWeights =
    Math.abs(weightSum - 1) > 1e-6
      ? (Object.fromEntries(
          Object.entries(weights).map(([k, v]) => [k, v / weightSum]),
        ) as unknown as ScoringWeights)
      : weights;

  const cookieDays = ctx?.cookieDays ?? DEFAULT_COOKIE_DAYS;
  const payoutFreq = ctx?.payoutFrequency ?? DEFAULT_PAYOUT_FREQUENCY;
  const ageMonths = ctx?.programAgeMonths ?? DEFAULT_PROGRAM_AGE_MONTHS;
  const approvalRate = ctx?.approvalRate ?? DEFAULT_APPROVAL_RATE;

  const breakdown: Record<keyof ScoringWeights, number> = {
    commission: scoreCommission(affiliate),
    epc: scoreEpc(affiliate),
    cookieDuration: scoreCookieDuration(cookieDays),
    payoutSpeed: scorePayoutSpeed(payoutFreq),
    programAge: scoreProgramAge(ageMonths),
    approvalRate: Math.min(Math.max(approvalRate, 0), 1),
  };

  let score =
    breakdown.commission * normWeights.commission +
    breakdown.epc * normWeights.epc +
    breakdown.cookieDuration * normWeights.cookieDuration +
    breakdown.payoutSpeed * normWeights.payoutSpeed +
    breakdown.programAge * normWeights.programAge +
    breakdown.approvalRate * normWeights.approvalRate;

  const risk = evaluateRisk(affiliate, ctx);
  score = risk.applyCryptoPenalty(score);

  const finalScore = Math.round(score * 1000) / 1000;
  const passes = finalScore >= threshold && !risk.isScamBlocked;

  return {
    score: finalScore,
    passes,
    breakdown,
    scamDetection: risk.scamDetection,
  };
}
