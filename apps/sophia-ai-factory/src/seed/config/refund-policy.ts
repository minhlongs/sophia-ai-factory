/**
 * Refund policy constants for Sophia AI Factory (Option A reconciled).
 *
 * Canonical rules (aligned with OPTION_A_PILOT_CONTRACT & /[locale]/terms):
 * - Standard subscriptions (BASIC/PREMIUM/ENTERPRISE): legacy 30-day window.
 * - BASIC pilot_14d (1,990,000 VND / 500 MCU / 0 video renders):
 *   7-day goodwill refund regardless of MCU usage; 14-day window for verified
 *   Sophia Option A campaign/script delivery failure; 100% of actual collection.
 * - MASTER tier: 14-day window.
 * - Third-party BYOK AI provider costs are billed directly by providers and never refunded by Sophia.
 */

import type { Tier } from '@/seed/types';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';

/** No reliable purchase-policy cutoff exists: preserve legacy standard coverage. */
/** Number of days within which a standard subscription refund request may be submitted. */
export const DEFAULT_REFUND_WINDOW_DAYS =
  OPTION_A_PILOT_CONTRACT.refundPolicy.standardSubscriptionWindowDays;

export const PILOT_GOODWILL_REFUND_WINDOW_DAYS =
  OPTION_A_PILOT_CONTRACT.refundPolicy.pilotGoodwillWindowDays;

export const PILOT_DELIVERY_FAILURE_REFUND_WINDOW_DAYS =
  OPTION_A_PILOT_CONTRACT.refundPolicy.pilotDeliveryFailureWindowDays;

/**
 * Per-tier refund windows.
 * BASIC/PREMIUM/ENTERPRISE: 30 days. MASTER: 14 days.
 */
export const TIER_REFUND_WINDOWS: Record<Tier, number> = {
  BASIC: DEFAULT_REFUND_WINDOW_DAYS,
  PREMIUM: DEFAULT_REFUND_WINDOW_DAYS,
  ENTERPRISE: DEFAULT_REFUND_WINDOW_DAYS,
  MASTER: OPTION_A_PILOT_CONTRACT.refundPolicy.masterWindowDays,
};

/**
 * Returns the refund window (in days) for the given tier and optional billing period.
 */
export function getRefundWindowDays(tier: Tier | string, period?: string): number {
  if (period === 'pilot_14d') {
    return PILOT_GOODWILL_REFUND_WINDOW_DAYS;
  }
  return TIER_REFUND_WINDOWS[tier as Tier] ?? DEFAULT_REFUND_WINDOW_DAYS;
}
