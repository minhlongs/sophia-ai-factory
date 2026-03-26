/**
 * TikTok Content Posting API OAuth2 client.
 * Handles authorization, token exchange, video publishing, and user info.
 * Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
 */

import { logger } from '@/lib/utils/logger-utility';

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_PUBLISH_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const TIKTOK_PUBLISH_STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

export interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  open_id: string;
}

export interface TikTokRefreshResponse {
  access_token: string;
  expires_in: number;
}

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

function getClientKey(): string {
  const key = process.env.TIKTOK_CLIENT_KEY;
  if (!key) throw new Error('TIKTOK_CLIENT_KEY is not configured');
  return key;
}

function getClientSecret(): string {
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  if (!secret) throw new Error('TIKTOK_CLIENT_SECRET is not configured');
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.TIKTOK_REDIRECT_URI;
  if (!uri) throw new Error('TIKTOK_REDIRECT_URI is not configured');
  return uri;
}

/** Build the TikTok OAuth2 authorization URL */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: getClientKey(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'user.info.basic,video.publish',
    state,
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

/** Exchange authorization code for access + refresh tokens */
export async function exchangeCodeForTokens(code: string): Promise<TikTokTokenResponse> {
  const body = new URLSearchParams({
    client_key: getClientKey(),
    client_secret: getClientSecret(),
    code,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
  });

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json() as { data?: TikTokTokenResponse; error?: string; error_description?: string };

  if (!response.ok || data.error) {
    const msg = data.error_description ?? data.error ?? 'Token exchange failed';
    logger.error('TikTok token exchange failed', new Error(msg), { status: response.status });
    throw new Error(msg);
  }

  if (!data.data) throw new Error('TikTok token response missing data');
  return data.data;
}

/** Refresh an expired access token */
export async function refreshAccessToken(refreshToken: string): Promise<TikTokRefreshResponse> {
  const body = new URLSearchParams({
    client_key: getClientKey(),
    client_secret: getClientSecret(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json() as { data?: TikTokRefreshResponse; error?: string; error_description?: string };

  if (!response.ok || data.error) {
    const msg = data.error_description ?? data.error ?? 'Token refresh failed';
    logger.error('TikTok token refresh failed', new Error(msg));
    throw new Error(msg);
  }

  if (!data.data) throw new Error('TikTok refresh response missing data');
  return data.data;
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
