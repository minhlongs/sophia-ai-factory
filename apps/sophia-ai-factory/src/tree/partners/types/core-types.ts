/**
 * Core Partner Enums, Constants, and Tier Thresholds
 *
 * Layer: tree (pure domain types & contracts)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/types/core-types
 */

export type PartnerTier = 'SILVER' | 'GOLD' | 'PLATINUM';

export type PartnerType = 'agency' | 'reseller' | 'affiliate' | 'integrator';

export type PartnerStatus = 'active' | 'suspended' | 'pending_approval';

export type PayoutRail = 'USDT' | 'VIETQR' | 'BANK_WIRE';

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'clawed_back';

/**
 * Partner Tier Configuration & Thresholds
 */
export interface TierThresholdConfig {
  tier: PartnerTier;
  ratePct: number;
  minCustomers: number;
  minMrrCents: number;
  whitelabelEnabled: boolean;
}

export const PARTNER_TIERS: Record<PartnerTier, TierThresholdConfig> = {
  SILVER: {
    tier: 'SILVER',
    ratePct: 20.0,
    minCustomers: 0,
    minMrrCents: 0,
    whitelabelEnabled: false,
  },
  GOLD: {
    tier: 'GOLD',
    ratePct: 28.0,
    minCustomers: 10,
    minMrrCents: 500_000, // $5,000
    whitelabelEnabled: false,
  },
  PLATINUM: {
    tier: 'PLATINUM',
    ratePct: 35.0,
    minCustomers: 30,
    minMrrCents: 2_000_000, // $20,000
    whitelabelEnabled: true,
  },
} as const;

/** 90-day referral attribution window in days */
export const ATTRIBUTION_WINDOW_DAYS = 90;
export const ATTRIBUTION_WINDOW_MS = ATTRIBUTION_WINDOW_DAYS * 86_400 * 1000;

/** Minimum payout threshold in cents ($50.00) */
export const MIN_PAYOUT_THRESHOLD_CENTS = 5_000;
