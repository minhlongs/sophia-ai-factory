/**
 * Refund policy constants for Sophia AI Factory.
 *
 * IMPORTANT — Product decision pending (PG-001):
 * The MASTER tier refund policy has NOT been finalized.
 * Long must decide: final-sale (no refund) | 30-day window | 14-day window.
 *
 * TODO(PG-001): Once Long decides the MASTER tier policy, update MASTER_REFUND_WINDOW_DAYS
 * and remove this comment. Also update pricing-and-tiers.md and FAQ accordingly.
 * Tracking: plans/260520-2216-gap-go-live/punch-list.md → PG-001.
 */

import type { Tier } from '@/seed/types';

/** Number of days within which a refund request may be submitted (measured from paid_at). */
export const DEFAULT_REFUND_WINDOW_DAYS = 30;

/**
 * Per-tier refund windows.
 * MASTER currently inherits the default 30-day window pending PG-001 product decision.
 */
export const TIER_REFUND_WINDOWS: Record<Tier, number> = {
  BASIC: DEFAULT_REFUND_WINDOW_DAYS,
  PREMIUM: DEFAULT_REFUND_WINDOW_DAYS,
  ENTERPRISE: DEFAULT_REFUND_WINDOW_DAYS,
  // TODO(PG-001): MASTER policy unresolved — defaulting to 30 days until Long decides.
  MASTER: DEFAULT_REFUND_WINDOW_DAYS,
};

/**
 * Returns the refund window (in days) for the given tier.
 * Falls back to DEFAULT_REFUND_WINDOW_DAYS for unknown tiers.
 */
export function getRefundWindowDays(tier: Tier | string): number {
  return TIER_REFUND_WINDOWS[tier as Tier] ?? DEFAULT_REFUND_WINDOW_DAYS;
}
