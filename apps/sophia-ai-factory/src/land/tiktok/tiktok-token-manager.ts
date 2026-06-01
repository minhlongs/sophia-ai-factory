/**
 * TikTok OAuth2 Token Manager
 * Handles auth URL generation and token exchange/refresh operations
 */

import { logger } from '@/seed/utils/logger-utility';

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

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
