/**
 * Social Syndication Pacing Types
 *
 * Domain contracts for staggered multi-platform video syndication,
 * smart pacing intervals, and anti-shadowban rate limiting.
 *
 * Layer: tree/social/syndication
 * @module tree/social/syndication/syndication-pacing-types
 */

export type SocialPlatform = 'tiktok' | 'youtube' | 'x';

export interface ChannelPublishState {
  channelId: string;
  platform: SocialPlatform;
  todayPublishedCount: number;
  lastPublishedAtMs: number | null;
}

export interface SyndicationPacingResult {
  allowed: boolean;
  delayMs: number;
  reason?: 'MAX_DAILY_QUOTA_REACHED' | 'MIN_INTERVAL_NOT_MET' | 'STAGGERED_OK';
  nextAvailableAtMs: number;
}
