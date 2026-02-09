/**
 * YouTube channel adapter for OpenClaw Gateway.
 * Stub implementation - logs intent for future YouTube Data API integration.
 */

import type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  PublishResult,
} from "../gateway-types";

const CHANNEL_ID = "youtube";

export class YouTubeChannelAdapter implements ChannelAdapter {
  private lastPublished: Date | undefined;

  /** Publish video content to YouTube (stub - logs intent) */
  async publish(content: CampaignOutput): Promise<PublishResult> {
    // TODO: Integrate with YouTube Data API v3
    // - Upload video via resumable upload endpoint
    // - Set title, description, tags from CampaignOutput
    // - Set thumbnail if provided
    // - Requires OAuth2 credentials with youtube.upload scope
    console.log(
      `[YouTubeAdapter] Would upload video for campaign ${content.campaignId}`,
      {
        title: content.title,
        videoUrl: content.videoUrl,
        tags: content.tags,
      },
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
      healthy: true,
      lastPublished: this.lastPublished,
      queueSize: 0,
    };
  }

  /** Check if the YouTube API connection is healthy */
  async healthCheck(): Promise<boolean> {
    // TODO: Verify YouTube API credentials and quota
    // - Check OAuth2 token validity
    // - Verify upload quota not exceeded
    return true;
  }
}
