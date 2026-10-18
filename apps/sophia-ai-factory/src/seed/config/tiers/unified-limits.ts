/**
 * Unified Tier Limits — Single source of truth for ALL tier limits.
 *
 * Covers both Video Factory and RaaS (AI Automation) features.
 * Payment handled by NOWPayments (invoice IDs in nowpayments-client.ts).
 * Do NOT put invoice IDs here — keep payment config in nowpayments-client.ts.
 */

import type { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from './unified-tier-definitions';

export { UNIFIED_TIERS };

export interface UnifiedTierLimits {
  /** Display name */
  name: string;
  /** Price in USD cents (e.g. 19900 = $199) */
  priceInCents: number;
  /** Price in USD dollars for display */
  price: number;
  currency: 'USDT';

  // ── Video Factory limits ────────────────────────────────────────────────
  /** Max video templates available */
  templates: number;
  /** Max campaigns per month */
  campaignsPerMonth: number;
  /** Max YouTube channels */
  youtubeChannels: number;

  // ── RaaS / AI Automation limits ─────────────────────────────────────────
  /** MCU (Model Compute Units) credits per month */
  mcuMonthly: number;
  /** AI command quota per month (0 = unlimited) */
  aiCommands: number;
  /** Max team members */
  teamMembers: number;
  /** API access enabled */
  apiAccess: boolean;
  /** Webhooks enabled */
  webhooks: boolean;
  /** Custom integrations enabled */
  customIntegrations: boolean;
  /** White-label license included */
  whiteLabel: boolean;
  /** Billing type: 'monthly' subscription or 'lifetime' one-time payment */
  billingType: 'monthly' | 'lifetime';
  /** Max SOP installations allowed */
  sopInstallLimit: number;
  /**
   * Annual price in USD dollars (0 for MASTER — lifetime has no annual option).
   * Equivalent to ~17% off 12 × monthly price.
   */
  yearlyPrice: number;
  /** Savings percentage shown on the annual toggle badge (0 for MASTER). */
  yearlySavingsPercent: number;
}

/** Get unified tier limits for a given tier key. */
export function getUnifiedTierLimits(tier: Tier): UnifiedTierLimits {
  return UNIFIED_TIERS[tier];
}

/** Get MCU monthly allowance for a tier (used by quota-checker). */
export function getMcuMonthlyLimit(tier: Tier): number {
  return UNIFIED_TIERS[tier].mcuMonthly;
}

/** Get AI command quota for a tier. Returns 999 for effectively unlimited tiers. */
export function getAiCommandLimit(tier: Tier): number {
  return UNIFIED_TIERS[tier].aiCommands;
}

/** Get max SOP installation count allowed for a tier. Defaults to 5 (BASIC) if tier unknown. */
export function getSopInstallLimit(tier: Tier): number {
  return UNIFIED_TIERS[tier]?.sopInstallLimit ?? 5;
}
