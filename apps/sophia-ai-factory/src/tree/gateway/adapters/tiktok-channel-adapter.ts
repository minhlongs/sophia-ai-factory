/**
 * TikTok channel adapter for OpenClaw Gateway.
 * Uses TikTok Content Posting API to publish videos via URL pull.
 * Reads access_token from Supabase user_profiles.api_keys JSONB.
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
import type { TikTokOAuthClient } from '@/tree/types/oauth-client-types';
import { logger } from '@/seed/utils/logger-utility';

const CHANNEL_ID = 'tiktok';
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20;

interface TikTokApiKeys {
  tiktok_access_token?: string;
}

export class TikTokChannelAdapter implements ChannelAdapter {
  private lastPublished: Date | undefined;
  private readonly apiKeys: TikTokApiKeys;
  private readonly oauthClient: TikTokOAuthClient;

  /**
   * In production, always pass oauthClient as first argument.
   * The default fallback (land import) is for test backward compat only.
   *
   * @param oauthClientOrApiKeys - TikTok OAuth client (production) or apiKeys object (backward compat)
   * @param apiKeys - TikTok API keys (production new-API only)
   */
  constructor(oauthClientOrApiKeys?: TikTokOAuthClient | TikTokApiKeys, apiKeys?: TikTokApiKeys) {
    if (oauthClientOrApiKeys && 'tiktok_access_token' in oauthClientOrApiKeys) {
      // Backward compat: dynamic import avoids tree→land boundary violation
      this.oauthClient = {
        publishVideo: (params) => import('@/land/tiktok/tiktok-oauth-client').then((m) => m.publishVideo(params)),
        checkPublishStatus: (token, id) => import('@/land/tiktok/tiktok-oauth-client').then((m) => m.checkPublishStatus(token, id)),
      };
      this.apiKeys = oauthClientOrApiKeys as TikTokApiKeys;
    } else {
      this.oauthClient = (oauthClientOrApiKeys as TikTokOAuthClient) ?? {
        publishVideo: (params) => import('@/land/tiktok/tiktok-oauth-client').then((m) => m.publishVideo(params)),
        checkPublishStatus: (token, id) => import('@/land/tiktok/tiktok-oauth-client').then((m) => m.checkPublishStatus(token, id)),
      };
      this.apiKeys = apiKeys ?? {};
    }
  }

  /** Publish video content to TikTok via Content Posting API */
  async publish(content: CampaignOutput): Promise<PublishResult> {
    const accessToken = this.apiKeys.tiktok_access_token;

    if (!accessToken) {
      return {
        channelId: CHANNEL_ID,
        success: false,
        error: 'TikTok access token not configured',
      };
    }

    try {
      const publishId = await this.oauthClient.publishVideo({
        accessToken,
        videoUrl: content.videoUrl,
        title: content.title,
      });

      logger.info('TikTok publish initiated', { campaignId: content.campaignId, publishId });

      const publicUrl = await this.pollPublishStatus(accessToken, publishId);

      this.lastPublished = new Date();

      return {
        channelId: CHANNEL_ID,
        success: true,
        publishedUrl: publicUrl,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TikTok publish failed', error, { campaignId: content.campaignId });
      return {
        channelId: CHANNEL_ID,
        success: false,
        error: error.message,
      };
    }
  }

  /** Poll TikTok publish status until complete or max attempts reached */
  private async pollPublishStatus(accessToken: string, publishId: string): Promise<string | undefined> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const result = await this.oauthClient.checkPublishStatus(accessToken, publishId);

      if (result.status === 'PUBLISH_COMPLETE') {
        return result.publicUrl;
      }

      if (result.status === 'FAILED') {
        throw new Error(`TikTok publish failed with status: ${result.status}`);
      }

      logger.debug('TikTok publish polling', { publishId, attempt, status: result.status });
    }

    logger.warn('TikTok publish polling timed out', { publishId });
    return undefined;
  }

  /** Get current channel status */
  async getStatus(): Promise<ChannelStatus> {
    return {
      channelId: CHANNEL_ID,
      healthy: !!this.apiKeys.tiktok_access_token,
      lastPublished: this.lastPublished,
      queueSize: 0,
    };
  }

  /** Check if TikTok is configured and healthy */
  async healthCheck(): Promise<boolean> {
    return !!this.apiKeys.tiktok_access_token;
  }
}
