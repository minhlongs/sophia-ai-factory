/**
 * YouTube Data API v3 OAuth2 client.
 * Uses fetch() directly — no googleapis package required.
 */

import {
  assertYouTubeOk,
  uploadVideo,
  getChannelInfo,
  type YouTubeChannelInfo,
  type UploadVideoParams,
} from './youtube-video-api';

export {
  uploadVideo,
  getChannelInfo,
  type YouTubeChannelInfo,
  type UploadVideoParams,
};

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

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

function getCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing YouTube OAuth credentials: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI');
  }
  return { clientId, clientSecret, redirectUri };
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
  await assertYouTubeOk(res, 'YouTube token exchange');
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
  await assertYouTubeOk(res, 'YouTube token refresh');
  return res.json() as Promise<YouTubeRefreshResponse>;
}
