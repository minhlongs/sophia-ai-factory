/**
 * X/Twitter OAuth 2.0 PKCE helpers + token exchange + refresh.
 * X v2 issues refresh_token when scope includes 'offline.access' (token TTL 2h).
 * X may rotate refresh_token — callers must persist new value when present.
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  basicAuthHeader,
  generatePkce,
  getAuthorizationUrl,
  TWITTER_SCOPES,
  type TwitterTokenResponse,
  type TwitterUserInfo,
} from './twitter-oauth-pkce';

export {
  TWITTER_SCOPES,
  generatePkce,
  getAuthorizationUrl,
  type TwitterTokenResponse,
  type TwitterUserInfo,
};

const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const X_USER_ME = 'https://api.x.com/2/users/me';

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TwitterTokenResponse> {
  if (!shouldAllowRequest('twitter')) {
    throw new Error('[Twitter] Circuit breaker open for twitter');
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  try {
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
      const kind = classifyHttpStatus(res.status);
      recordFailure('twitter', kind);
      throw new Error(`X token exchange failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
    recordSuccess('twitter');
    return res.json() as Promise<TwitterTokenResponse>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('twitter', classifyError(error));
    throw error;
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TwitterTokenResponse> {
  if (!shouldAllowRequest('twitter')) {
    throw new Error('[Twitter] Circuit breaker open for twitter');
  }
  try {
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
      const kind = classifyHttpStatus(res.status);
      recordFailure('twitter', kind);
      throw new Error(`X token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
    recordSuccess('twitter');
    return res.json() as Promise<TwitterTokenResponse>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('twitter', classifyError(error));
    throw error;
  }
}

export async function getUserInfo(accessToken: string): Promise<TwitterUserInfo> {
  if (!shouldAllowRequest('twitter')) {
    throw new Error('[Twitter] Circuit breaker open for twitter');
  }
  try {
    const res = await fetch(X_USER_ME, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const kind = classifyHttpStatus(res.status);
      recordFailure('twitter', kind);
      throw new Error(`X /users/me failed: HTTP ${res.status}`);
    }
    recordSuccess('twitter');
    const json = (await res.json()) as { data?: TwitterUserInfo };
    if (!json.data) throw new Error('X /users/me returned no data');
    return json.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('twitter', classifyError(error));
    throw error;
  }
}

export const twitterOAuthClient = {
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserInfo,
};
