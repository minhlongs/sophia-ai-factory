/**
 * Refund policy constants for Sophia AI Factory.
 *
 * IMPORTANT — Product decision pending (PG-001):
 * The MASTER tier refund policy has NOT been finalized.
 * Long must decide: final-sale (no refund) | 30-day window | 14-day window.
 *
 * UNRESOLVED(PG-001): MASTER tier refund policy requires product decision.
 * Options: final-sale (no refund) | 30-day window | 14-day window.
 * Current: MASTER inherits DEFAULT_REFUND_WINDOW_DAYS (30 days) as safe default.
 * Tracking: plans/260520-2216-gap-go-live/punch-list.md → PG-001.
 * Resolution required from: Long (product owner)
 */

import type { Tier } from '@/seed/types';

/** Number of days within which a refund request may be submitted (measured from paid_at). */
export const DEFAULT_REFUND_WINDOW_DAYS = 30;

/**
 * Per-tier refund windows.
 * MASTER uses DEFAULT_REFUND_WINDOW_DAYS pending PG-001 product decision.
 */
export const TIER_REFUND_WINDOWS: Record<Tier, number> = {
  BASIC: DEFAULT_REFUND_WINDOW_DAYS,
  PREMIUM: DEFAULT_REFUND_WINDOW_DAYS,
  ENTERPRISE: DEFAULT_REFUND_WINDOW_DAYS,
  // UNRESOLVED(PG-001): MASTER policy — awaiting product decision from Long
  MASTER: DEFAULT_REFUND_WINDOW_DAYS,
};

/**
 * Returns the refund window (in days) for the given tier.
 * Falls back to DEFAULT_REFUND_WINDOW_DAYS for unknown tiers.
 */
export function getRefundWindowDays(tier: Tier | string): number {
  return TIER_REFUND_WINDOWS[tier as Tier] ?? DEFAULT_REFUND_WINDOW_DAYS;
}
