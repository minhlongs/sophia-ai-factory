/**
 * Per-tier limits for the Social RNN (Social Publishing) module.
 * Canonical source for TIER_SOCIAL_LIMITS.
 *
 * BASIC   → locked (no social features)
 * PREMIUM → 5 channels, 50 publishes/month
 * ENTERPRISE → 12 channels, 200 publishes/month
 * MASTER  → unlimited
 */

import { Tier } from '@/seed/types';

export interface SocialTierLimits {
  socialEnabled: boolean;
  maxChannels: number;
  maxPublishPerMonth: number;
  engagementData: boolean;
}

export const TIER_SOCIAL_LIMITS: Record<Tier, SocialTierLimits> = {
  BASIC: {
    socialEnabled: false,
    maxChannels: 0,
    maxPublishPerMonth: 0,
    engagementData: false,
  },
  PREMIUM: {
    socialEnabled: true,
    maxChannels: 5,
    maxPublishPerMonth: 50,
    engagementData: true,
  },
  ENTERPRISE: {
    socialEnabled: true,
    maxChannels: 12,
    maxPublishPerMonth: 200,
    engagementData: true,
  },
  MASTER: {
    socialEnabled: true,
    maxChannels: Infinity,
    maxPublishPerMonth: Infinity,
    engagementData: true,
  },
} as const;

/** Get social limits for a tier — falls back to BASIC (locked) for unknown tiers */
export function getSocialTierLimits(tier: string): SocialTierLimits {
  const t = tier.toUpperCase() as Tier;
  if (t in TIER_SOCIAL_LIMITS) return TIER_SOCIAL_LIMITS[t];
  return TIER_SOCIAL_LIMITS.BASIC;
}
