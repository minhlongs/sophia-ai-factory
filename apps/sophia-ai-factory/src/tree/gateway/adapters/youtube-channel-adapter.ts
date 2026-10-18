/**
 * YouTube channel adapter for OpenClaw Gateway.
 * Real implementation using YouTube Data API v3 OAuth2.
 * Requires a userId to look up the stored refresh token from Supabase.
 * Gracefully degrades when OAuth credentials or refresh token are missing.
 *
 * Layer compliance: oauthClient is constructor-injected (production).
 * Default fallback import below is for test backward compat only.
 */

import type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  PublishResult,
} from '@/tree/gateway/gateway-types';
import { type YouTubeOAuthClient, getYouTubeOAuthClient } from '@/tree/types/oauth-client-types';
import { logger } from '@/seed/utils/logger-utility';
import {
  YOUTUBE_CHANNEL_ID,
  isYouTubeEnvConfigured,
  resolveYouTubeAccessToken,
} from './youtube-token-manager';

export class YouTubeChannelAdapter implements ChannelAdapter {
  private lastPublished: Date | undefined;
  private readonly userId: string | undefined;
  private readonly oauthClient: YouTubeOAuthClient;

  /**
   * In production, pass oauthClient or rely on registered default client.
   *
   * @param oauthClientOrUserId - YouTube OAuth client or userId string
   * @param userId - User ID for credential lookup (when client passed as first arg)
   */
  constructor(oauthClientOrUserId?: YouTubeOAuthClient | string, userId?: string) {
    const fallbackClient: YouTubeOAuthClient = getYouTubeOAuthClient() ?? {
      uploadVideo: () => Promise.reject(new Error('YouTube OAuth client not registered')),
      refreshAccessToken: () => Promise.reject(new Error('YouTube OAuth client not registered')),
    };

    if (typeof oauthClientOrUserId === 'string' || oauthClientOrUserId === undefined) {
      this.oauthClient = fallbackClient;
      this.userId = typeof oauthClientOrUserId === 'string' ? oauthClientOrUserId : userId;
    } else {
      this.oauthClient = oauthClientOrUserId;
      this.userId = userId;
    }
  }

  /** Retrieve a valid access token, refreshing if necessary */
  private async getAccessToken(): Promise<string> {
    return resolveYouTubeAccessToken(this.userId, this.oauthClient);
  }

  /** Publish video content to YouTube using OAuth2 */
  async publish(content: CampaignOutput): Promise<PublishResult> {
    if (!isYouTubeEnvConfigured()) {
      return {
        channelId: YOUTUBE_CHANNEL_ID,
        success: false,
        error: 'YouTube OAuth credentials not configured',
      };
    }

    if (!this.userId) {
      return {
        channelId: YOUTUBE_CHANNEL_ID,
        success: false,
        error: 'No userId provided to YouTubeChannelAdapter',
      };
    }

    try {
      const accessToken = await this.getAccessToken();

      const publishedUrl = await this.oauthClient.uploadVideo({
        accessToken,
        videoUrl: content.videoUrl,
        title: content.title,
        description: content.description,
        tags: content.tags,
      });

      this.lastPublished = new Date();
      logger.info('YouTube video published', { campaignId: content.campaignId, publishedUrl });

      return { channelId: YOUTUBE_CHANNEL_ID, success: true, publishedUrl };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('YouTube publish failed', error, { campaignId: content.campaignId });
      return { channelId: YOUTUBE_CHANNEL_ID, success: false, error: error.message };
    }
  }

  /** Get current channel status */
  async getStatus(): Promise<ChannelStatus> {
    return {
      channelId: YOUTUBE_CHANNEL_ID,
      healthy: isYouTubeEnvConfigured() && !!this.userId,
      lastPublished: this.lastPublished,
      queueSize: 0,
    };
  }

  /** Check if the YouTube connection is healthy */
  async healthCheck(): Promise<boolean> {
    return isYouTubeEnvConfigured() && !!this.userId;
  }
}
