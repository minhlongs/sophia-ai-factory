/**
 * Commission Math & Tier Qualification Rules.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/commission-math
 */

import {
  PARTNER_TIERS,
  ATTRIBUTION_WINDOW_MS,
  type PartnerTier,
} from '@/tree/partners/types';

/**
 * Pure integer cent commission calculation.
 * Ensures zero penny leakage with mathematical floor.
 *
 * Invariant: commissionCents is always non-negative integer <= mrrCents.
 */
export function calculateCommissionCents(mrrCents: number, commissionRatePct: number): number {
  if (mrrCents <= 0 || commissionRatePct <= 0) {
    return 0;
  }
  return Math.floor((mrrCents * commissionRatePct) / 100);
}

/**
 * Evaluates Partner Tier qualifications based on active customers and MRR.
 * - PLATINUM (35%): >= 30 customers OR >= $20,000 (2,000,000 cents) MRR
 * - GOLD (28%): >= 10 customers OR >= $5,000 (500,000 cents) MRR
 * - SILVER (20%): Baseline
 */
export function determinePartnerTier(
  referredCustomers: number,
  referredMrrCents: number,
): { tier: PartnerTier; commissionRatePct: number; whitelabelEnabled: boolean } {
  if (referredCustomers >= 30 || referredMrrCents >= 2_000_000) {
    return {
      tier: 'PLATINUM',
      commissionRatePct: PARTNER_TIERS.PLATINUM.ratePct,
      whitelabelEnabled: true,
    };
  }

  if (referredCustomers >= 10 || referredMrrCents >= 500_000) {
    return {
      tier: 'GOLD',
      commissionRatePct: PARTNER_TIERS.GOLD.ratePct,
      whitelabelEnabled: false,
    };
  }

  return {
    tier: 'SILVER',
    commissionRatePct: PARTNER_TIERS.SILVER.ratePct,
    whitelabelEnabled: false,
  };
}

/**
 * Calculates progress towards next tier for partner gamification.
 */
export function calculateNextTierProgress(
  currentTier: PartnerTier,
  customers: number,
  mrrCents: number,
): {
  targetTier: PartnerTier | null;
  customersRemaining: number;
  mrrRemainingCents: number;
  progressPct: number;
} {
  if (currentTier === 'PLATINUM') {
    return {
      targetTier: null,
      customersRemaining: 0,
      mrrRemainingCents: 0,
      progressPct: 100,
    };
  }

  const target = currentTier === 'SILVER' ? PARTNER_TIERS.GOLD : PARTNER_TIERS.PLATINUM;
  const customersRemaining = Math.max(0, target.minCustomers - customers);
  const mrrRemainingCents = Math.max(0, target.minMrrCents - mrrCents);

  const customerPct = target.minCustomers > 0 ? (customers / target.minCustomers) * 100 : 0;
  const mrrPct = target.minMrrCents > 0 ? (mrrCents / target.minMrrCents) * 100 : 0;
  const progressPct = Math.min(100, Math.max(0, Math.floor(Math.max(customerPct, mrrPct))));

  return {
    targetTier: target.tier,
    customersRemaining,
    mrrRemainingCents,
    progressPct,
  };
}

/**
 * Checks if a conversion occurs within the 90-day referral attribution window.
 */
export function isWithinAttributionWindow(
  attributedAtMs: number,
  eventTimeMs = Date.now(),
  windowMs = ATTRIBUTION_WINDOW_MS,
): boolean {
  if (eventTimeMs < attributedAtMs) {
    return false;
  }
  return eventTimeMs - attributedAtMs <= windowMs;
}
