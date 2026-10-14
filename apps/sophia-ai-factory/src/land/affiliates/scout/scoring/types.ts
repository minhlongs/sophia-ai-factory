/**
 * @module land/affiliates/scout/scoring/types
 * Type definitions and constants for affiliate quality scoring.
 */

import type { ScamDetectionResult } from '../scam-detector';

export interface ScoringWeights {
  commission: number; // default 0.30
  epc: number; // default 0.25
  cookieDuration: number; // default 0.15
  payoutSpeed: number; // default 0.10
  programAge: number; // default 0.10
  approvalRate: number; // default 0.10
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

export const DEFAULT_WEIGHTS: ScoringWeights = {
  commission: 0.30,
  epc: 0.25,
  cookieDuration: 0.15,
  payoutSpeed: 0.10,
  programAge: 0.10,
  approvalRate: 0.10,
};

export const DEFAULT_THRESHOLD = 0.7;
export const DEFAULT_COOKIE_DAYS = 30;
export const DEFAULT_PAYOUT_FREQUENCY: NonNullable<ScoringContext['payoutFrequency']> = 'monthly';
export const DEFAULT_PROGRAM_AGE_MONTHS = 6;
export const DEFAULT_APPROVAL_RATE = 0.5;
export const DEFAULT_EPC_SCORE = 0.5;
export const SCAM_RISK_FAIL_THRESHOLD = 0.5;
export const CRYPTO_VOLUME_THRESHOLD_USD = 1_000_000;

export const MAX_FLAT_USD = 200;
export const MAX_COOKIE_DAYS = 180;
export const MAX_PROGRAM_MONTHS = 36;
export const MAX_EPC_USD = 10;

export const PAYOUT_SCORES: Record<NonNullable<ScoringContext['payoutFrequency']>, number> = {
  daily: 1.0,
  weekly: 0.8,
  monthly: 0.5,
  quarterly: 0.2,
};
