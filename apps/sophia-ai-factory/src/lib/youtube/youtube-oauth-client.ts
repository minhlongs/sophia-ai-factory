/**
 * YouTube Data API v3 OAuth2 client.
 * Uses fetch() directly — no googleapis package required.
 */

import { logger } from '@/lib/utils/logger-utility';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

export interface YouTubeTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface YouTubeRefreshResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  thumbnailUrl: string;
}

export interface UploadVideoParams {
  accessToken: string;
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
}

function getCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing YouTube OAuth credentials: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI');
  }
  return { clientId, clientSecret, redirectUri };
}

async function assertOk(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const text = await res.text();
    logger.error(`${label} failed`, new Error(text), { status: res.status });
    throw new Error(`${label} failed: ${res.status}`);
  }
}

/** Build the Google OAuth2 authorization URL */
export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** Exchange an authorization code for access + refresh tokens */
export async function exchangeCodeForTokens(code: string): Promise<YouTubeTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString(),
  });
  await assertOk(res, 'YouTube token exchange');
  return res.json() as Promise<YouTubeTokenResponse>;
}

/** Refresh an expired access token using the stored refresh token */
export async function refreshAccessToken(refreshToken: string): Promise<YouTubeRefreshResponse> {
  const { clientId, clientSecret } = getCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }).toString(),
  });
  await assertOk(res, 'YouTube token refresh');
  return res.json() as Promise<YouTubeRefreshResponse>;
}

/** Upload a video via resumable upload and return the YouTube watch URL */
export async function uploadVideo(params: UploadVideoParams): Promise<string> {
  const { accessToken, videoUrl, title, description, tags } = params;

  const videoRes = await fetch(videoUrl);
  await assertOk(videoRes, 'Video source fetch');
  const videoBlob = await videoRes.blob();
  const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

  const metadata = {
    snippet: { title, description, tags, categoryId: '22' },
    status: { privacyStatus: 'public' },
  };

  const initRes = await fetch(`${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(videoBlob.size),
    },
    body: JSON.stringify(metadata),
  });
  await assertOk(initRes, 'YouTube upload initiation');

  const uploadUri = initRes.headers.get('Location');
  if (!uploadUri) throw new Error('YouTube did not return a resumable upload URI');

  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(videoBlob.size) },
    body: videoBlob,
  });
  await assertOk(uploadRes, 'YouTube video upload');

  const result = (await uploadRes.json()) as { id: string };
  return `https://www.youtube.com/watch?v=${result.id}`;
}

/** Fetch authenticated user's YouTube channel info */
export async function getChannelInfo(accessToken: string): Promise<YouTubeChannelInfo> {
  const res = await fetch(`${YOUTUBE_CHANNELS_URL}?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await assertOk(res, 'YouTube channel info fetch');

  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      snippet: { title: string; thumbnails: { default?: { url: string } } };
    }>;
  };

  const channel = data.items?.[0];
  if (!channel) throw new Error('No YouTube channel found for this account');

  return {
    channelId: channel.id,
    title: channel.snippet.title,
    thumbnailUrl: channel.snippet.thumbnails.default?.url ?? '',
  };
}
