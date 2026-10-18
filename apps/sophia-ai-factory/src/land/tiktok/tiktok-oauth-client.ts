/**
 * TikTok Content Posting API OAuth2 client.
 * Token operations: tiktok-token-manager.ts
 * This file: video publish + user info API methods
 *
 * Layer: land
 *
 * @module land/tiktok/tiktok-oauth-client
 */

import { logger } from '@/seed/utils/logger-utility';
import { registerTikTokOAuthClient } from '@/tree/types/oauth-client-types';
import {
  TIKTOK_PUBLISH_INIT_URL,
  TIKTOK_PUBLISH_STATUS_URL,
  TIKTOK_USER_INFO_URL,
  buildTikTokPublishPayload,
  buildTikTokJsonHeaders,
  type TikTokPublishParams,
  type TikTokPublishStatus,
  type TikTokUserInfo,
  type TikTokApiEnvelope,
} from './tiktok-oauth-helpers';

export type {
  TikTokTokenResponse,
  TikTokRefreshResponse,
} from '@/tree/publishing/tiktok/tiktok-token-manager';

export {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from '@/tree/publishing/tiktok/tiktok-token-manager';

export type { TikTokPublishParams, TikTokPublishStatus, TikTokUserInfo };

/** Initiate a video publish — TikTok downloads from videoUrl — returns publish_id */
export async function publishVideo(params: TikTokPublishParams): Promise<string> {
  const { accessToken, videoUrl, title } = params;

  const response = await fetch(TIKTOK_PUBLISH_INIT_URL, {
    method: 'POST',
    headers: buildTikTokJsonHeaders(accessToken),
    body: buildTikTokPublishPayload(title, videoUrl),
  });

  const data = (await response.json()) as TikTokApiEnvelope<{ publish_id: string }>;

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
    headers: buildTikTokJsonHeaders(accessToken),
    body: JSON.stringify({ publish_id: publishId }),
  });

  const data = (await response.json()) as TikTokApiEnvelope<{
    status: string;
    publicaly_available_post_id?: string[];
  }>;

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

  const data = (await response.json()) as TikTokApiEnvelope<{ user?: TikTokUserInfo }>;

  if (!response.ok || data.error?.code) {
    const msg = data.error?.message ?? 'Failed to fetch user info';
    logger.error('TikTok user info fetch failed', new Error(msg));
    throw new Error(msg);
  }

  if (!data.data?.user) throw new Error('TikTok user info response missing user');
  return data.data.user;
}

registerTikTokOAuthClient({ publishVideo, checkPublishStatus });
