/**
 * Tier mappings, subscription gate rankings, and billing constants.
 *
 * @module seed/config/tiers/tier-mappings
 */

import { Tier } from '@/seed/types';

/** NOWPayments pre-created invoice IDs (static, no runtime dependency needed) */
export const NOWPAYMENTS_INVOICE_IDS: Record<string, string> = {
  BASIC: '5710519960',
  PREMIUM: '4559269964',
  ENTERPRISE: '6336799275',
  MASTER: '5589879034',
};

/** Tier rank/label/features for subscription gate checks */
export const TIER_CONFIG: Record<Tier, { rank: number; label: string; features: string[] }> = {
  BASIC: { rank: 1, label: 'Starter', features: ['1 YouTube Channel', '5 Templates', 'Basic Analytics'] },
  PREMIUM: { rank: 2, label: 'Growth', features: ['3 YouTube Channels', 'Unlimited Templates', 'Advanced Analytics', 'Priority Support'] },
  ENTERPRISE: { rank: 3, label: 'Premium', features: ['Unlimited Channels', 'Custom Templates', 'Custom Integrations', 'Dedicated Account Manager', 'API Access'] },
  MASTER: { rank: 4, label: 'Master', features: ['Everything in Enterprise', 'Lifetime Access', 'VIP Support Forever', 'Monthly Strategy Calls', 'Early Access'] },
};

/** Map DB values → Tier enum */
export const DB_TIER_MAPPING: Record<string, Tier> = {
  'basic': 'BASIC',
  'premium': 'PREMIUM',
  'pro': 'PREMIUM',
  'enterprise': 'ENTERPRISE',
  'master': 'MASTER',
  'free': 'BASIC',
};

/** Map Tier enum → DB values */
export const TIER_DB_MAPPING: Record<Tier, string> = {
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
  MASTER: 'master',
};

/** Tiers that allow video generation (PREMIUM+ required) */
export const TIER_ALLOWED_VIDEO: Tier[] = ['PREMIUM', 'ENTERPRISE', 'MASTER'];

/** Price per MCU credit for overage top-ups (USD). Canonical location — imported by land and forest layers. */
export const TOPUP_PRICE_PER_MCU = 0.10;

/**
 * Default referral reward amount in cents (USD).
 * Overridable via REFERRAL_REWARD_CENTS env var.
 * Used by POST /api/referral/generate when creating new codes.
 */
export const REFERRAL_REWARD_CENTS = Number(process.env.REFERRAL_REWARD_CENTS) || 1990;
