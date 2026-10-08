/**
 * @file virality-weights.ts
 * @description Virality scoring weight configurations for TikTok, YouTube Shorts, and Instagram Reels.
 * @layer seed
 */

export interface TikTokWeightConfig {
  readonly completion: number;
  readonly rewatch: number;
  readonly share: number;
  readonly retentionAt3s: number;
}

export interface YouTubeShortsWeightConfig {
  readonly viewedVsSwiped: number;
  readonly completionRate: number;
  readonly engagementLikes: number;
  readonly subscriptionGain: number;
}

export interface InstagramReelsWeightConfig {
  readonly dmShare: number;
  readonly save: number;
  readonly completionRate: number;
  readonly comments: number;
}

export interface PlatformViralityWeights {
  readonly TIKTOK: TikTokWeightConfig;
  readonly YOUTUBE_SHORTS: YouTubeShortsWeightConfig;
  readonly INSTAGRAM_REELS: InstagramReelsWeightConfig;
}

/**
 * Platform weight constants specifying retention, engagement, and viral signals.
 * - TikTok: completion (0.35) + rewatch (0.30) + share (0.25) + 3s retention (0.10) = 1.00
 * - YouTube Shorts: viewed vs swiped (0.45) + completion (0.35) + likes (0.10) + sub gains (0.10) = 1.00
 * - Instagram Reels: DM share (0.40) + saves (0.30) + completion (0.20) + comments (0.10) = 1.00
 */
export const VIRALITY_WEIGHTS: PlatformViralityWeights = {
  TIKTOK: {
    completion: 0.35,
    rewatch: 0.30,
    share: 0.25,
    retentionAt3s: 0.10,
  },
  YOUTUBE_SHORTS: {
    viewedVsSwiped: 0.45,
    completionRate: 0.35,
    engagementLikes: 0.10,
    subscriptionGain: 0.10,
  },
  INSTAGRAM_REELS: {
    dmShare: 0.40,
    save: 0.30,
    completionRate: 0.20,
    comments: 0.10,
  },
} as const;

/**
 * Off-peak compute arbitrage discount thresholds.
 * Off-peak hours yield up to 40% compute token savings.
 */
export const COMPUTE_ARBITRAGE_CONFIG = {
  OFF_PEAK_DISCOUNT_RATIO: 0.40,
  HIGH_VELOCITY_THRESHOLD_SCORE: 80.0,
  LOW_VELOCITY_DEGRADATION_THRESHOLD: 40.0,
  DEFAULT_MAX_WAIT_OFF_PEAK_HOURS: 6,
} as const;

/**
 * Validates that all weight vectors sum up to 1.0 (with floating point tolerance).
 */
export function validateWeightVector(
  weights: Record<string, number> | { readonly [k: string]: number } | object,
  tolerance = 0.0001
): boolean {
  const values = Object.values(weights) as number[];
  const sum = values.reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
  return Math.abs(sum - 1.0) <= tolerance;
}
