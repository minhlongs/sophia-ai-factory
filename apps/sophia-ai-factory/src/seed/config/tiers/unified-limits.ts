/**
 * Unified Tier Limits — Single source of truth for ALL tier limits.
 *
 * Covers both Video Factory and RaaS (AI Automation) features.
 * Payment handled by NOWPayments (invoice IDs in nowpayments-client.ts).
 * Do NOT put invoice IDs here — keep payment config in nowpayments-client.ts.
 */

import type { Tier } from '@/seed/types';

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
}

/** Canonical tier definitions used by all tier checks, quota logic, and pricing UI. */
export const UNIFIED_TIERS: Record<Tier, UnifiedTierLimits> = {
  BASIC: {
    name: 'Starter',
    priceInCents: 19900,
    price: 199,
    currency: 'USDT',
    templates: 5,
    campaignsPerMonth: 10,
    youtubeChannels: 1,
    mcuMonthly: 1000,
    aiCommands: 5,
    teamMembers: 1,
    apiAccess: false,
    webhooks: false,
    customIntegrations: false,
    whiteLabel: false,
    billingType: 'monthly',
  },

  PREMIUM: {
    name: 'Growth',
    priceInCents: 39900,
    price: 399,
    currency: 'USDT',
    templates: 999,
    campaignsPerMonth: 50,
    youtubeChannels: 3,
    mcuMonthly: 5000,
    aiCommands: 15,
    teamMembers: 5,
    apiAccess: true,
    webhooks: true,
    customIntegrations: false,
    whiteLabel: false,
    billingType: 'monthly',
  },

  ENTERPRISE: {
    name: 'Premium',
    priceInCents: 79900,
    price: 799,
    currency: 'USDT',
    templates: 999,
    campaignsPerMonth: 999,
    youtubeChannels: 999,
    mcuMonthly: 20000,
    aiCommands: 15,
    teamMembers: 999,
    apiAccess: true,
    webhooks: true,
    customIntegrations: true,
    whiteLabel: false,
    billingType: 'monthly',
  },

  MASTER: {
    name: 'Master',
    priceInCents: 499900,
    price: 4999,
    currency: 'USDT',
    templates: 999,
    campaignsPerMonth: 999,
    youtubeChannels: 999,
    mcuMonthly: 100000,
    aiCommands: 999,
    teamMembers: 999,
    apiAccess: true,
    webhooks: true,
    customIntegrations: true,
    whiteLabel: true,
    billingType: 'lifetime',
  },
} as const;

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
