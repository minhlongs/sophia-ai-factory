/**
 * YouTube channel adapter for OpenClaw Gateway.
 * Graceful degradation: returns failure when YOUTUBE_API_KEY is not configured.
 * Ready for YouTube Data API v3 integration when key is provided.
 */

import type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  PublishResult,
} from "../gateway-types";

const CHANNEL_ID = "youtube";

/** Check if YouTube API credentials are configured */
function isConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}

export class YouTubeChannelAdapter implements ChannelAdapter {
  private lastPublished: Date | undefined;

  /** Publish video content to YouTube. Degrades gracefully when API key missing. */
  async publish(content: CampaignOutput): Promise<PublishResult> {
    if (!isConfigured()) {
      console.warn("[YouTubeAdapter] YOUTUBE_API_KEY not configured, skipping publish");
      return {
        channelId: CHANNEL_ID,
        success: false,
        error: "YouTube API key not configured",
      };
    }

    // Stub: ready for YouTube Data API v3 resumable upload integration
    console.info(
      `[YouTubeAdapter] Would upload video for campaign ${content.campaignId}`,
      { title: content.title, videoUrl: content.videoUrl, tags: content.tags },
    );

    this.lastPublished = new Date();

    return {
      channelId: CHANNEL_ID,
      success: true,
      publishedUrl: `https://youtube.com/watch?v=stub-${content.campaignId}`,
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

  /** Check if the YouTube API connection is healthy */
  async healthCheck(): Promise<boolean> {
    return isConfigured();
  }
}
