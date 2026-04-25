/**
 * TikTok Content Posting API OAuth2 client.
 * Token operations: tiktok-token-manager.ts
 * This file: video publish + user info API methods
 */

import { logger } from '@/lib/utils/logger-utility';

export type {
  TikTokTokenResponse,
  TikTokRefreshResponse,
} from './tiktok-token-manager';

export {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from './tiktok-token-manager';

const TIKTOK_PUBLISH_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const TIKTOK_PUBLISH_STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

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

/** Initiate a video publish — TikTok downloads from videoUrl — returns publish_id */
export async function publishVideo(params: TikTokPublishParams): Promise<string> {
  const { accessToken, videoUrl, title } = params;

  const response = await fetch(TIKTOK_PUBLISH_INIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
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
    }),
  });

  const data = await response.json() as { data?: { publish_id: string }; error?: { message: string; code: string } };

  if (!response.ok || data.error?.code) {
    const msg = data.error?.message ?? 'Video publish init failed';
    logger.error('TikTok publish init failed', new Error(msg), { status: response.status });
    throw new Error(msg);
  }

  if (!data.data?.publish_id) throw new Error('TikTok publish response missing publish_id');
  return data.data.publish_id;
}

/** Poll publish status — returns status and public URL when available */
export async function checkPublishStatus(
  accessToken: string,
  publishId: string,
): Promise<TikTokPublishStatus> {
  const response = await fetch(TIKTOK_PUBLISH_STATUS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ publish_id: publishId }),
  });

  const data = await response.json() as {
    data?: { status: string; publicaly_available_post_id?: string[] };
    error?: { message: string; code: string };
  };

  if (!response.ok || data.error?.code) {
    const msg = data.error?.message ?? 'Publish status check failed';
    logger.error('TikTok publish status check failed', new Error(msg));
    throw new Error(msg);
  }

  const postId = data.data?.publicaly_available_post_id?.[0];
  return {
    status: data.data?.status ?? 'UNKNOWN',
    publicUrl: postId ? `https://www.tiktok.com/video/${postId}` : undefined,
  };
}

/** Get basic user info via access token */
export async function getUserInfo(accessToken: string): Promise<TikTokUserInfo> {
  const url = `${TIKTOK_USER_INFO_URL}?fields=open_id,display_name,avatar_url`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json() as {
    data?: { user?: TikTokUserInfo };
    error?: { message: string; code: string };
  };

  if (!response.ok || data.error?.code) {
    const msg = data.error?.message ?? 'Failed to fetch user info';
    logger.error('TikTok user info fetch failed', new Error(msg));
    throw new Error(msg);
  }

  if (!data.data?.user) throw new Error('TikTok user info response missing user');
  return data.data.user;
}
