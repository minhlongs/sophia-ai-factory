/**
 * Affiliate quality scoring framework.
 *
 * Produces a composite score 0..1 from five weighted components.
 * Threshold 0.7 = "kèo thơm" (quality pass). Tenant-customizable.
 *
 * @module lib/affiliates/scout/scoring
 */

import type { Affiliate } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoringWeights {
  commission: number;      // default 0.4
  cookieDuration: number;  // default 0.2
  payoutSpeed: number;     // default 0.15
  programAge: number;      // default 0.15
  approvalRate: number;    // default 0.1
}

export interface ScoringContext {
  weights?: Partial<ScoringWeights>;
  /** Minimum score to be considered "kèo thơm". Default 0.7 */
  threshold?: number;
  /**
   * Cookie window in days (if not stored on the Affiliate record).
   * Injected per-network at call site.
   */
  cookieDays?: number;
  /**
   * Payout frequency token.
   * 'daily' | 'weekly' | 'monthly' | 'quarterly'
   */
  payoutFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  /** Program age in months (if not stored on the Affiliate record). */
  programAgeMonths?: number;
  /** Approval rate 0..1 (if not stored on the Affiliate record). */
  approvalRate?: number;
}

export interface ScoredAffiliate {
  score: number;
  passes: boolean;
  breakdown: Record<keyof ScoringWeights, number>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS: ScoringWeights = {
  commission: 0.4,
  cookieDuration: 0.2,
  payoutSpeed: 0.15,
  programAge: 0.15,
  approvalRate: 0.1,
};

const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_COOKIE_DAYS = 30;
const DEFAULT_PAYOUT_FREQUENCY: NonNullable<ScoringContext['payoutFrequency']> = 'monthly';
const DEFAULT_PROGRAM_AGE_MONTHS = 6;
const DEFAULT_APPROVAL_RATE = 0.5;

// Normalisation constants
const MAX_FLAT_USD = 200;   // $200 flat = score 1.0
const MAX_COOKIE_DAYS = 180;
const MAX_PROGRAM_MONTHS = 36;

// ---------------------------------------------------------------------------
// Component scorers
// ---------------------------------------------------------------------------

function scoreCommission(aff: Affiliate): number {
  if (aff.commissionPct != null && aff.commissionPct > 0) {
    return Math.min(aff.commissionPct / 100, 1.0);
  }
  if (aff.commissionFlatUsd != null && aff.commissionFlatUsd > 0) {
    return Math.min(aff.commissionFlatUsd / MAX_FLAT_USD, 1.0);
  }
  return 0;
}

function scoreCookieDuration(days: number): number {
  if (days <= 0) return 0;
  const log = Math.log10(days) / Math.log10(MAX_COOKIE_DAYS);
  return Math.min(log, 1.0);
}

const PAYOUT_SCORES: Record<NonNullable<ScoringContext['payoutFrequency']>, number> = {
  daily: 1.0,
  weekly: 0.8,
  monthly: 0.5,
  quarterly: 0.2,
};

function scorePayoutSpeed(freq: NonNullable<ScoringContext['payoutFrequency']>): number {
  return PAYOUT_SCORES[freq] ?? 0.5;
}

function scoreProgramAge(months: number): number {
  if (months <= 0) return 0;
  const log = Math.log10(months) / Math.log10(MAX_PROGRAM_MONTHS);
  return Math.min(log, 1.0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a composite quality score for an affiliate offer.
 *
 * Components not present on the `Affiliate` record must be supplied via
 * `ScoringContext` (cookieDays, payoutFrequency, programAgeMonths, approvalRate).
 */
export function scoreAffiliate(
  affiliate: Affiliate,
  ctx?: ScoringContext,
): ScoredAffiliate {
  const weights: ScoringWeights = { ...DEFAULT_WEIGHTS, ...ctx?.weights };
  const threshold = ctx?.threshold ?? DEFAULT_THRESHOLD;

  // Normalise weights to sum = 1 (tolerant of custom configs)
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  const normWeights: ScoringWeights =
    Math.abs(weightSum - 1) > 1e-6
      ? (Object.fromEntries(
          Object.entries(weights).map(([k, v]) => [k, v / weightSum]),
        ) as unknown as ScoringWeights)
      : weights;

  // Resolve runtime values with defaults
  const cookieDays = ctx?.cookieDays ?? DEFAULT_COOKIE_DAYS;
  const payoutFreq = ctx?.payoutFrequency ?? DEFAULT_PAYOUT_FREQUENCY;
  const ageMonths = ctx?.programAgeMonths ?? DEFAULT_PROGRAM_AGE_MONTHS;
  const approvalRate = ctx?.approvalRate ?? DEFAULT_APPROVAL_RATE;

  const breakdown: Record<keyof ScoringWeights, number> = {
    commission: scoreCommission(affiliate),
    cookieDuration: scoreCookieDuration(cookieDays),
    payoutSpeed: scorePayoutSpeed(payoutFreq),
    programAge: scoreProgramAge(ageMonths),
    approvalRate: Math.min(Math.max(approvalRate, 0), 1),
  };

  const score =
    breakdown.commission * normWeights.commission +
    breakdown.cookieDuration * normWeights.cookieDuration +
    breakdown.payoutSpeed * normWeights.payoutSpeed +
    breakdown.programAge * normWeights.programAge +
    breakdown.approvalRate * normWeights.approvalRate;

  return {
    score: Math.round(score * 1000) / 1000, // 3 dp
    passes: score >= threshold,
    breakdown,
  };
}
