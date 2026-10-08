/**
 * Growth Triad v12 Config & Weights
 * Thresholds for Z-score virality classification, token auto-refresh, and anti-cannibalization.
 * Layer: seed/config/growth | Max LOC: < 200 | Zero :any
 * @module seed/config/growth/flywheel-weights
 */

export const FLYWHEEL_CONFIG = {
  // Statistical Z-score thresholds
  Z_SCORE_ALPHA_VIRAL_THRESHOLD: 1.5, // >= +1.5 standard deviations above channel mean
  Z_SCORE_STAGNANT_THRESHOLD: -0.5,   // < -0.5 standard deviations

  // Minimum required views before applying statistical Z-score
  MIN_SAMPLE_VIEWS_FOR_ZSCORE: 500,

  // Default fallback baseline when channel historical data is sparse (< 5 videos)
  DEFAULT_CHANNEL_BASELINES: {
    YOUTUBE_SHORTS: { meanRetention: 65.0, stdDev: 12.0 },
    TIKTOK_V2: { meanRetention: 58.0, stdDev: 14.0 },
    INSTAGRAM_REELS: { meanRetention: 52.0, stdDev: 11.0 },
  },

  // Token auto-refresh: trigger refresh if expires within 2 hours (in ms)
  TOKEN_REFRESH_LEAD_TIME_MS: 2 * 60 * 60 * 1000,

  // Anti-cannibalization limits: maximum autonomous reseed jobs per channel per 24h
  MAX_DAILY_AUTONOMOUS_RESEEDS_PER_CHANNEL: 2,

  // Jaccard / Jensen-Shannon divergence minimum distance between mutated hooks
  MIN_HOOK_DIVERGENCE_DISTANCE: 0.15,
} as const;
