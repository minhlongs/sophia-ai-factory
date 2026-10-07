/**
 * Niche Video Social Syndication Types
 *
 * Defines contracts for multi-platform distribution payloads (YouTube Shorts,
 * TikTok, Instagram Reels) optimized for SaaS & Crypto affiliate monetization.
 *
 * Layer: tree/video/syndication (Domain Reusable Logic)
 * @module tree/video/syndication/niche-syndication-types
 */

export type SocialPlatform = 'youtube_shorts' | 'tiktok' | 'instagram_reels';

export interface PinnedCommentSpec {
  text: string;
  trackedUrl: string;
  hasDisclaimer: boolean;
  couponCode?: string;
  callToAction: string;
}

export interface SocialPostPayload {
  platform: SocialPlatform;
  title: string;
  caption: string;
  description?: string;
  hashtags: string[];
  trackedUrl: string;
  pinnedComment: PinnedCommentSpec;
  soundRecommendation?: string;
  optimalPostingTimesUtc: string[];
}

export interface NicheSyndicationPackage {
  planId: string;
  productName: string;
  niche: 'saas_global' | 'crypto_global';
  generatedAt: string;
  platforms: Record<SocialPlatform, SocialPostPayload>;
}
