/**
 * channel-cooldown-rules.ts — Per-channel cooldown and burst-protection constants.
 *
 * Cooldown = minimum gap (seconds) between two consecutive posts to the same channel.
 * Burst limit = max posts per channel within any rolling 1-hour window.
 *
 * Rules are informed by platform algorithm behaviour and API rate-limit docs.
 * Adjust via environment override if needed (future work).
 *
 * @module seed/config/channel-cooldown-rules
 */

import type { ChannelProvider } from '@/lib/publishing/publisher-interface';

/** Minimum gap in seconds between consecutive posts on each channel. */
export const CHANNEL_COOLDOWN_SECONDS: Record<ChannelProvider, number> = {
  tiktok: 4 * 3600,      // 4 h — algorithm punishes burst posting
  instagram: 2 * 3600,   // 2 h
  youtube: 6 * 3600,     // 6 h — Shorts (longform uses 24 h, handled separately)
  linkedin: 6 * 3600,    // 6 h — B2B audience fatigue
  pinterest: 30 * 60,    // 30 min — high-volume tolerance
  twitter: 15 * 60,      // 15 min — X/Twitter
  threads: 1 * 3600,     // 1 h
  facebook: 2 * 3600,    // 2 h
  reddit: 6 * 3600,      // 6 h — subreddit-aware deferred to later
  bluesky: 30 * 60,      // 30 min
  mastodon: 30 * 60,     // 30 min
  zalo: 4 * 3600,        // 4 h — Zalo OA quota limited
  telegram: 5 * 60,      // 5 min — channel, low risk
};

/** Maximum posts per channel within any rolling 60-minute window. */
export const BURST_LIMIT_PER_HOUR: number = 3;

/** Window size (seconds) for burst-protection rolling count. */
export const BURST_WINDOW_SECONDS: number = 3600;
