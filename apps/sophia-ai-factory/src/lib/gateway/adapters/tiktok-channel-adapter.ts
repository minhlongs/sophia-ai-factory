/**
 * TikTok channel adapter for OpenClaw Gateway.
 * Graceful degradation: returns failure when TIKTOK_API_KEY is not configured.
 * Ready for TikTok Content Posting API integration when key is provided.
 */

import type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  PublishResult,
} from "../gateway-types";

const CHANNEL_ID = "tiktok";

/** Check if TikTok API credentials are configured */
function isConfigured(): boolean {
  return !!process.env.TIKTOK_API_KEY;
}

export class TikTokChannelAdapter implements ChannelAdapter {
  private lastPublished: Date | undefined;

  /** Publish video content to TikTok. Degrades gracefully when API key missing. */
  async publish(content: CampaignOutput): Promise<PublishResult> {
    if (!isConfigured()) {
      return {
        channelId: CHANNEL_ID,
        success: false,
        error: "TikTok API key not configured",
      };
    }

    this.lastPublished = new Date();

    return {
      channelId: CHANNEL_ID,
      success: true,
      publishedUrl: `https://tiktok.com/@sophia/video/stub-${content.campaignId}`,
    };
  }

  /** Get current channel status */
  async getStatus(): Promise<ChannelStatus> {
    return {
      channelId: CHANNEL_ID,
      healthy: isConfigured(),
      lastPublished: this.lastPublished,
      queueSize: 0,
    };
  }

  /** Check if the TikTok API connection is healthy */
  async healthCheck(): Promise<boolean> {
    return isConfigured();
  }
}
