/**
 * TikTok channel adapter for OpenClaw Gateway.
 * Stub implementation - logs intent for future TikTok Content Posting API integration.
 */

import type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  PublishResult,
} from "../gateway-types";

const CHANNEL_ID = "tiktok";

export class TikTokChannelAdapter implements ChannelAdapter {
  private lastPublished: Date | undefined;

  /** Publish video content to TikTok (stub - logs intent) */
  async publish(content: CampaignOutput): Promise<PublishResult> {
    // TODO: Integrate with TikTok Content Posting API
    // - Use POST /v2/post/publish/video/init/ to initiate upload
    // - Upload video file to provided upload URL
    // - Set caption from title + description
    // - Requires TikTok developer app with content.publish scope
    console.log(
      `[TikTokAdapter] Would upload video for campaign ${content.campaignId}`,
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
      publishedUrl: `https://tiktok.com/@sophia/video/stub-${content.campaignId}`,
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

  /** Check if the TikTok API connection is healthy */
  async healthCheck(): Promise<boolean> {
    // TODO: Verify TikTok API credentials
    // - Check access token validity
    // - Verify daily posting quota not exceeded
    return true;
  }
}
