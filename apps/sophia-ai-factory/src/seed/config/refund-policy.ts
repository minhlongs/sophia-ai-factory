/**
 * Refund policy constants for Sophia AI Factory.
 *
 * PG-001 RESOLVED (2026-06-29): MASTER tier = 14-day refund window.
 * BASIC/PREMIUM/ENTERPRISE = 30-day default window.
 */

import type { Tier } from '@/seed/types';

/** Number of days within which a refund request may be submitted (measured from paid_at). */
export const DEFAULT_REFUND_WINDOW_DAYS = 30;

/**
 * Per-tier refund windows.
 * MASTER: 14 days (decided 2026-06-29 — tighter window for high-value tier).
 */
export const TIER_REFUND_WINDOWS: Record<Tier, number> = {
  BASIC: DEFAULT_REFUND_WINDOW_DAYS,
  PREMIUM: DEFAULT_REFUND_WINDOW_DAYS,
  ENTERPRISE: DEFAULT_REFUND_WINDOW_DAYS,
  MASTER: 14,
};

/**
 * Returns the refund window (in days) for the given tier.
 * Falls back to DEFAULT_REFUND_WINDOW_DAYS for unknown tiers.
 */
export function getRefundWindowDays(tier: Tier | string): number {
  return TIER_REFUND_WINDOWS[tier as Tier] ?? DEFAULT_REFUND_WINDOW_DAYS;
}
