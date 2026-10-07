/**
 * Social Account Pool & Distribution types for TikTok, YouTube Shorts & Instagram Reels.
 */

export type SocialPlatform = 'tiktok' | 'youtube_shorts' | 'instagram_reels';

export type AccountStatus =
  | 'active'
  | 'warming_up'
  | 'cooldown'
  | 'rate_limited'
  | 'suspended';

export interface SocialAccountProfile {
  id: string;
  platform: SocialPlatform;
  handle: string;
  niche: 'saas_global' | 'crypto_global';
  status: AccountStatus;
  dailyPostLimit: number;
  postsPublishedToday: number;
  lastPublishedAt?: string; // ISO string
  proxyUrl?: string; // Dedicated residential proxy
  warmingPhaseDays: number;
}

export interface PublishPayload {
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
  pinnedComment: string;
  affiliateTrackedUrl: string;
  targetPlatform: SocialPlatform;
  niche: 'saas_global' | 'crypto_global';
}

export interface DispatchResult {
  success: boolean;
  selectedAccountId: string;
  platform: SocialPlatform;
  scheduledTime?: string;
  proxyUsed?: string;
  rateLimitRemaining: number;
  error?: string;
}
