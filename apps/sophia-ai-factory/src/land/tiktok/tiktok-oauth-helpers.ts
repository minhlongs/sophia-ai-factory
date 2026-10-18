/**
 * TikTok Content Posting API constants, interfaces, and payload builders.
 *
 * Layer: land
 * @module land/tiktok/tiktok-oauth-helpers
 */

export const TIKTOK_PUBLISH_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
export const TIKTOK_PUBLISH_STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
export const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

export interface TikTokPublishParams {
  accessToken: string;
  videoUrl: string;
  title: string;
}

export interface TikTokPublishStatus {
  status: string;
  publicUrl?: string;
}

export interface TikTokUserInfo {
  open_id: string;
  display_name: string;
  avatar_url: string;
}

export interface TikTokApiEnvelope<T> {
  data?: T;
  error?: { message: string; code: string };
}

export function buildTikTokPublishPayload(title: string, videoUrl: string): string {
  return JSON.stringify({
    post_info: {
      title,
      privacy_level: 'SELF_ONLY',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: videoUrl,
    },
  });
}

export function buildTikTokJsonHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
  };
}
