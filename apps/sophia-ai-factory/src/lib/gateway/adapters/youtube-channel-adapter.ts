/**
 * YouTube channel adapter for OpenClaw Gateway.
 * Real implementation using YouTube Data API v3 OAuth2.
 * Requires a userId to look up the stored refresh token from Supabase.
 * Gracefully degrades when OAuth credentials or refresh token are missing.
 */

import type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  PublishResult,
} from "../gateway-types";
import {
  uploadVideo,
  refreshAccessToken,
} from "@/lib/youtube/youtube-oauth-client";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger-utility";

const CHANNEL_ID = "youtube";

/** Shape of YouTube credentials stored in user_profiles.api_keys */
interface StoredYouTubeCredentials {
  refresh_token: string;
  access_token?: string;
  expires_at?: number;
}

/** Check if YouTube OAuth credentials are configured in the environment */
function isEnvConfigured(): boolean {
  return (
    !!process.env.YOUTUBE_CLIENT_ID &&
    !!process.env.YOUTUBE_CLIENT_SECRET &&
    !!process.env.YOUTUBE_REDIRECT_URI
  );
}

export class YouTubeChannelAdapter implements ChannelAdapter {
  private lastPublished: Date | undefined;
  private readonly userId: string | undefined;

  /**
   * @param userId - Supabase user ID used to look up stored OAuth refresh token.
   *                 When omitted, adapter degrades gracefully (no publish).
   */
  constructor(userId?: string) {
    this.userId = userId;
  }

  /** Retrieve a valid access token, refreshing if necessary */
  private async getAccessToken(): Promise<string> {
    if (!this.userId) {
      throw new Error("No userId provided — cannot fetch YouTube credentials");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("api_keys")
      .eq("user_id", this.userId)
      .single();

    if (error || !data?.api_keys) {
      throw new Error("YouTube credentials not found in user profile");
    }

    const apiKeys = data.api_keys as Record<string, unknown>;
    const creds = apiKeys["youtube"] as StoredYouTubeCredentials | undefined;

    if (!creds?.refresh_token) {
      throw new Error("YouTube refresh token not found — user must reconnect");
    }

    // Check if stored access token is still valid (with 60s buffer)
    const nowSec = Math.floor(Date.now() / 1000);
    if (creds.access_token && creds.expires_at && creds.expires_at > nowSec + 60) {
      return creds.access_token;
    }

    // Refresh the access token
    const refreshed = await refreshAccessToken(creds.refresh_token);

    // Persist updated access token back to Supabase
    const updatedApiKeys = {
      ...apiKeys,
      youtube: {
        ...creds,
        access_token: refreshed.access_token,
        expires_at: nowSec + refreshed.expires_in,
      },
    };

    await supabase
      .from("user_profiles")
      .update({ api_keys: updatedApiKeys })
      .eq("user_id", this.userId);

    return refreshed.access_token;
  }

  /** Publish video content to YouTube using OAuth2 */
  async publish(content: CampaignOutput): Promise<PublishResult> {
    if (!isEnvConfigured()) {
      return {
        channelId: CHANNEL_ID,
        success: false,
        error: "YouTube OAuth credentials not configured",
      };
    }

    if (!this.userId) {
      return {
        channelId: CHANNEL_ID,
        success: false,
        error: "No userId provided to YouTubeChannelAdapter",
      };
    }

    try {
      const accessToken = await this.getAccessToken();

      const publishedUrl = await uploadVideo({
        accessToken,
        videoUrl: content.videoUrl,
        title: content.title,
        description: content.description,
        tags: content.tags,
      });

      this.lastPublished = new Date();
      logger.info("YouTube video published", { campaignId: content.campaignId, publishedUrl });

      return { channelId: CHANNEL_ID, success: true, publishedUrl };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("YouTube publish failed", error, { campaignId: content.campaignId });
      return { channelId: CHANNEL_ID, success: false, error: error.message };
    }
  }

  /** Get current channel status */
  async getStatus(): Promise<ChannelStatus> {
    return {
      channelId: CHANNEL_ID,
      healthy: isEnvConfigured() && !!this.userId,
      lastPublished: this.lastPublished,
      queueSize: 0,
    };
  }

  /** Check if the YouTube connection is healthy */
  async healthCheck(): Promise<boolean> {
    return isEnvConfigured() && !!this.userId;
  }
}
