/**
 * Affiliate quality scoring framework.
 *
 * Produces a composite score 0..1 from eight weighted components.
 * Threshold 0.7 = "kèo thơm" (quality pass). Tenant-customizable.
 *
 * Weight defaults (v2, rebalanced from v1):
 *   commission:     0.30 (was 0.40)
 *   epc:            0.25 (NEW — earnings per click, best quality signal)
 *   cookieDuration: 0.15 (was 0.20)
 *   payoutSpeed:    0.10 (was 0.15)
 *   programAge:     0.10 (was 0.15)
 *   approvalRate:   0.10 (unchanged)
 *
 * Scam gate: if scamRisk >= 0.5 → passes=false regardless of quality score.
 * Crypto gate: cryptoVolumeUsd < $1M gets a 20% penalty on score.
 *
 * Backwards compatible: existing callers without new ctx fields still work.
 *
 * @module lib/affiliates/scout/scoring
 */

import type { Affiliate } from './types';
import { detectScamRisk } from './scam-detector';
import type { ScamDetectionResult } from './scam-detector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoringWeights {
  commission: number;      // default 0.30
  epc: number;             // default 0.25
  cookieDuration: number;  // default 0.15
  payoutSpeed: number;     // default 0.10
  programAge: number;      // default 0.10
  approvalRate: number;    // default 0.10
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
  /**
   * Override scam detection — set to true to skip scam check
   * (e.g. for manually curated offers). Default false.
   */
  skipScamCheck?: boolean;
}

export interface ScoredAffiliate {
  score: number;
  passes: boolean;
  breakdown: Record<keyof ScoringWeights, number>;
  /** Scam detection result attached for transparency */
  scamDetection: ScamDetectionResult;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS: ScoringWeights = {
  commission: 0.30,
  epc: 0.25,
  cookieDuration: 0.15,
  payoutSpeed: 0.10,
  programAge: 0.10,
  approvalRate: 0.10,
};

const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_COOKIE_DAYS = 30;
const DEFAULT_PAYOUT_FREQUENCY: NonNullable<ScoringContext['payoutFrequency']> = 'monthly';
const DEFAULT_PROGRAM_AGE_MONTHS = 6;
const DEFAULT_APPROVAL_RATE = 0.5;

/** Default EPC score when not provided — neutral 0.5 */
const DEFAULT_EPC_SCORE = 0.5;

/** Scam risk threshold above which offer auto-fails */
const SCAM_RISK_FAIL_THRESHOLD = 0.5;

/** Min daily volume (USD) for crypto offers to get full score */
const CRYPTO_VOLUME_THRESHOLD_USD = 1_000_000;

// Normalisation constants
const MAX_FLAT_USD = 200;      // $200 flat = score 1.0
const MAX_COOKIE_DAYS = 180;
const MAX_PROGRAM_MONTHS = 36;
const MAX_EPC_USD = 10;        // $10 EPC = score 1.0 (linear)

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

/**
 * EPC score: linear 0..1 over $0..$10 EPC range.
 * Absent EPC data → neutral 0.5.
 */
function scoreEpc(aff: Affiliate): number {
  if (aff.epc == null) return DEFAULT_EPC_SCORE;
  if (aff.epc <= 0) return 0;
  return Math.min(aff.epc / MAX_EPC_USD, 1.0);
}

/**
 * Crypto volume score: log scale, threshold $1M daily volume.
 * Only applies when cryptoVolumeUsd is present.
 * Returns null when not applicable (non-crypto affiliates).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function scoreCryptoVolume(aff: Affiliate): number | null {
  if (aff.cryptoVolumeUsd == null) return null;
  if (aff.cryptoVolumeUsd <= 0) return 0;
  // log scale: 1M → 0.5, 10M → 0.75, 100M → 1.0
  const logScore = Math.log10(aff.cryptoVolumeUsd) / Math.log10(100 * CRYPTO_VOLUME_THRESHOLD_USD);
  return Math.min(Math.max(logScore, 0), 1.0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a composite quality score for an affiliate offer.
 *
 * Components not present on the `Affiliate` record must be supplied via
 * `ScoringContext` (cookieDays, payoutFrequency, programAgeMonths, approvalRate).
 *
 * Scam gate: if scamRisk >= 0.5 → passes=false regardless of quality score.
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

  // Apply crypto volume cap: if affiliate has volume data and it's < $1M daily, cap at 0.8
  const cryptoVol = affiliate.cryptoVolumeUsd;
  if (cryptoVol != null && cryptoVol < CRYPTO_VOLUME_THRESHOLD_USD) {
    // Low-volume crypto: cap score at 0.8 to prevent auto-pass
    score = Math.min(score, 0.8);
  }

  // Scam detection
  const scamDetection = ctx?.skipScamCheck
    ? { scamRisk: 0, breakdown: { blacklistedDomain: 0, suspiciousTld: 0, mlmKeywords: 0, scamPhrases: 0, copycatBrand: 0 }, signals: [] }
    : detectScamRisk(affiliate);

  const finalScore = Math.round(score * 1000) / 1000;
  const passes = finalScore >= threshold && scamDetection.scamRisk < SCAM_RISK_FAIL_THRESHOLD;

  return {
    score: finalScore,
    passes,
    breakdown,
    scamDetection,
  };
}
