/**
 * @module land/affiliates/scout/scoring/epc-calculator
 * Component score calculators for individual affiliate attributes.
 */

import type { Affiliate } from '../types';
import {
  type ScoringContext,
  MAX_FLAT_USD,
  MAX_COOKIE_DAYS,
  MAX_PROGRAM_MONTHS,
  MAX_EPC_USD,
  DEFAULT_EPC_SCORE,
  PAYOUT_SCORES,
} from './types';

export function scoreCommission(aff: Affiliate): number {
  if (aff.commissionPct != null && aff.commissionPct > 0) {
    return Math.min(aff.commissionPct / 100, 1.0);
  }
  if (aff.commissionFlatUsd != null && aff.commissionFlatUsd > 0) {
    return Math.min(aff.commissionFlatUsd / MAX_FLAT_USD, 1.0);
  }
  return 0;
}

export function scoreCookieDuration(days: number): number {
  if (days <= 0) return 0;
  const log = Math.log10(days) / Math.log10(MAX_COOKIE_DAYS);
  return Math.min(log, 1.0);
}

export function scorePayoutSpeed(freq: NonNullable<ScoringContext['payoutFrequency']>): number {
  return PAYOUT_SCORES[freq] ?? 0.5;
}

export function scoreProgramAge(months: number): number {
  if (months <= 0) return 0;
  const log = Math.log10(months) / Math.log10(MAX_PROGRAM_MONTHS);
  return Math.min(log, 1.0);
}

export function scoreEpc(aff: Affiliate): number {
  if (aff.epc == null) return DEFAULT_EPC_SCORE;
  // A commission-derived forecast is not an observed metric: score it neutral
  // instead of letting a guessed number drive the quality ranking.
  if (aff.epcProvenance === 'commission_derived_estimate' || aff.epcProvenance === 'unknown') {
    return DEFAULT_EPC_SCORE;
  }
  if (aff.epc <= 0) return 0;
  return Math.min(aff.epc / MAX_EPC_USD, 1.0);
}
