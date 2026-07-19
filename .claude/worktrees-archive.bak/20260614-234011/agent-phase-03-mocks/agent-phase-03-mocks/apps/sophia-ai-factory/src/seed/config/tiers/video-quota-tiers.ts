/**
 * Video Quota Tier Config — Phase 11
 *
 * Defines per-tenant video/storage limits for the three RaaS tiers.
 * -1 means unlimited. monthlyPriceUSDT is the recurring charge in USDT.
 *
 * This is the single source of truth for video quota enforcement in
 * quota-enforcer.ts and the admin quota API.
 */

export interface VideoTierLimits {
  /** Max videos per month. -1 = unlimited */
  videosPerMonth: number;
  /** Max total video seconds per month. -1 = unlimited */
  videoSecondsPerMonth: number;
  /** Max R2 storage in GB. -1 = unlimited */
  storageGB: number;
  /** Max publishing channels connected. -1 = unlimited */
  channelsLimit: number;
  /** Recurring price in USDT per month. 0 = free */
  monthlyPriceUSDT: number;
  /** Max videos per batch. 0 = batch disabled */
  batchLimit: number;
}

export type VideoTierKey = 'free' | 'pro' | 'enterprise';

export const VIDEO_TIER_CONFIG: Record<VideoTierKey, VideoTierLimits> = {
  free: {
    videosPerMonth: 10,
    videoSecondsPerMonth: 30 * 10,
    storageGB: 1,
    channelsLimit: 1,
    monthlyPriceUSDT: 0,
    batchLimit: 0,
  },
  pro: {
    videosPerMonth: 100,
    videoSecondsPerMonth: 60 * 100,
    storageGB: 10,
    channelsLimit: 3,
    monthlyPriceUSDT: 9,
    batchLimit: 50,
  },
  enterprise: {
    videosPerMonth: -1,
    videoSecondsPerMonth: -1,
    storageGB: 100,
    channelsLimit: 10,
    monthlyPriceUSDT: 49,
    batchLimit: 500,
  },
};

/** Resolve video tier limits for a given tier key. */
export function getVideoTierLimits(tier: VideoTierKey): VideoTierLimits {
  return VIDEO_TIER_CONFIG[tier];
}

/** Map Better Auth DB tier strings → video tier key */
export function toVideoTierKey(dbTier: string): VideoTierKey {
  const lower = dbTier.toLowerCase();
  if (lower === 'pro' || lower === 'premium') return 'pro';
  if (lower === 'enterprise' || lower === 'master') return 'enterprise';
  return 'free';
}
