/**
 * Core domain types and payload contracts for Social Direct Publisher.
 * Multi-platform direct publishing to YouTube Shorts, TikTok v2, and Instagram Reels.
 *
 * @module seed/types/social-publisher-types
 */

export type SocialPlatform = 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';

export type PublishJobStatus = 'PENDING' | 'PACED' | 'UPLOADING' | 'PUBLISHED' | 'FAILED';

export type PacingStatus = 'READY' | 'COOLDOWN' | 'DAILY_LIMIT_REACHED' | 'KILL_SWITCH_ACTIVE';

export interface OAuthTokenPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType?: string;
  scope?: string[];
}

export interface VaultDerivationContext {
  userId: string;
  platform: SocialPlatform;
  channelId: string;
}

export interface EncryptedVaultEnvelope {
  iv: string;
  tag: string;
  ciphertext: string;
  algorithm: 'AES-256-GCM';
  keyDerivation: 'HKDF-SHA256';
  version: number;
}

export interface PlatformCredentialRecord {
  id: string;
  userId: string;
  platform: SocialPlatform;
  channelId: string;
  channelName: string;
  encryptedTokens: string;
  tokenExpiresAt: number;
  dailyPostCount: number;
  lastPublishedAt?: number;
  killSwitchActive: boolean;
  lockVersion: number;
  updatedAt: number;
}

export interface SocialPublishJobInput {
  userId: string;
  channelId: string;
  platform: SocialPlatform;
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  scheduledFor?: number;
}

export interface SocialPublishResult {
  jobId: string;
  platform: SocialPlatform;
  status: PublishJobStatus;
  platformPostId?: string;
  publishedUrl?: string;
  error?: string;
  completedAt?: number;
}

export interface ChannelPacingState {
  channelId: string;
  platform: SocialPlatform;
  status: PacingStatus;
  cooldownRemainingMs: number;
  dailyPostsRemaining: number;
  nextAllowedPublishAt: number;
}
