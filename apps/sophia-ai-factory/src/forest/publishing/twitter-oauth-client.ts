/**
 * X/Twitter OAuth 2.0 PKCE helpers + token exchange + refresh.
 * X v2 issues refresh_token when scope includes 'offline.access' (token TTL 2h).
 * X may rotate refresh_token — callers must persist new value when present.
 */

import { logger } from '@/seed/utils/logger-utility';

const X_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const X_USER_ME = 'https://api.x.com/2/users/me';

export const TWITTER_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'media.write',
  'offline.access',
];

export interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export interface TwitterUserInfo {
  id: string;
  username: string;
  name: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/** Generate PKCE pair: code_verifier (43-128 chars) + code_challenge (S256). */
export async function generatePkce(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(verifierBytes);
  const challengeBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(challengeBuf));
  return { codeVerifier, codeChallenge };
}

export function getAuthorizationUrl(state: string, codeChallenge: string): string {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !appUrl) throw new Error('TWITTER_CLIENT_ID / NEXT_PUBLIC_APP_URL not set');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${appUrl}/api/oauth/twitter/callback`,
    scope: TWITTER_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

function basicAuthHeader(): string {
  const id = process.env.TWITTER_CLIENT_ID ?? '';
  const secret = process.env.TWITTER_CLIENT_SECRET ?? '';
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TwitterTokenResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const res = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appUrl}/api/oauth/twitter/callback`,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch((err) => {
      logger.warn('Failed to read X token exchange response', { error: String(err), context: 'exchangeCodeForTokens' });
      return '';
    });
    throw new Error(`X token exchange failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<TwitterTokenResponse>;
}

export async function refreshAccessToken(refreshToken: string): Promise<TwitterTokenResponse> {
  const res = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch((err) => {
      logger.warn('Failed to read X token refresh response', { error: String(err), context: 'refreshAccessToken' });
      return '';
    });
    throw new Error(`X token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<TwitterTokenResponse>;
}

export async function getUserInfo(accessToken: string): Promise<TwitterUserInfo> {
  const res = await fetch(X_USER_ME, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    logger.error('[twitter-oauth] getUserInfo failed', new Error(`HTTP ${res.status}`));
    throw new Error(`X /users/me failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: TwitterUserInfo };
  if (!json.data) throw new Error('X /users/me returned no data');
  return json.data;
}
