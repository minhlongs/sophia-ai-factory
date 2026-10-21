/**
 * Revenue share constants for affiliate commission splits.
 * User receives 70% of net commission; Sophia platform retains 30%.
 *
 * Affiliate commission is keyed on the *referred customer's* subscription
 * tier, not the partner's tier. A partner referring a high-value enterprise
 * customer earns marginally less than the same partner referring a basic
 * customer, because enterprise gross value carries lower margin view.
 *
 * @module config/revenue-share
 */

import type { Tier } from '@/seed/types';

/** Fraction of gross commission credited to the user (70%) */
export const USER_SHARE_PCT = 0.70

/** Fraction of gross commission retained by Sophia platform (30%) */
export const SOPHIA_SHARE_PCT = 0.30

/**
 * Commission percentage per referred customer tier, expressed 0-100.
 * Applied to every attribution event by `land/affiliates/rate-resolver`.
 */
export const AFFILIATE_RATE_BY_TIER: Record<Tier, number> = {
  BASIC: 30,
  PREMIUM: 25,
  ENTERPRISE: 20,
  MASTER: 10,
};

/**
 * Number of recurring months an affiliate earns per referred customer.
 * MASTER referrals are compensated once — a MASTER subscription is a
 * lifetime tier, so there is no recurring monthly share to distribute.
 */
export const AFFILIATE_RECURRING_MONTHS = 12;

/**
 * Rate applied when neither a partner override nor a resolvable customer
 * tier is available. Kept aligned with DEFAULT_COMMISSION_RATE_PCT so that
 * legacy commissions predating tier-based rates never regress in value.
 */
export const FALLBACK_COMMISSION_RATE_PCT = 20;

/**
 * Minimum matured commission total a partner must accrue before a NET-30
 * payout is created ($50.00). Below this, the aggregation and rail cost
 * exceeds the value moved.
 */
export const AFFILIATE_MIN_PAYOUT_CENTS = 5000;

/**
 * Matured totals at or below this amount are auto-approved ($500.00).
 * Anything larger routes to `pending_approval` for an admin to review.
 */
export const AFFILIATE_AUTO_APPROVE_MAX_CENTS = 50_000;
