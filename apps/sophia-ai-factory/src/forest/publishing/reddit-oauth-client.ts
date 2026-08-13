/**
 * Reddit OAuth 2.0 helpers via reddit.com/api/v1.
 * Uses permanent duration tokens (refresh_token never expires server-side).
 * Auth: HTTP Basic (client_id:client_secret) for all token requests.
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const REDDIT_AUTHORIZE = 'https://www.reddit.com/api/v1/authorize';
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_ME_URL = 'https://oauth.reddit.com/api/v1/me';

export const REDDIT_SCOPES = ['identity', 'submit', 'read'];

export interface RedditTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in: number;
  scope?: string;
}

export interface RedditUserInfo {
  id: string;
  name: string;
}

function basicAuthHeader(): string {
  const id = process.env.REDDIT_CLIENT_ID ?? '';
  const secret = process.env.REDDIT_CLIENT_SECRET ?? '';
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

export function getAuthorizationUrl(state: string): string {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !appUrl) throw new Error('REDDIT_CLIENT_ID / NEXT_PUBLIC_APP_URL not set');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: `${appUrl}/api/oauth/reddit/callback`,
    duration: 'permanent',
    scope: REDDIT_SCOPES.join(' '),
  });
  return `${REDDIT_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<RedditTokenResponse> {
  if (!shouldAllowRequest('reddit')) {
    throw new Error('[Reddit] Circuit breaker open for reddit');
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  try {
    const res = await fetch(REDDIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SophiaAIFactory/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/oauth/reddit/callback`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read Reddit token exchange response', { error: String(err), context: 'exchangeCodeForTokens' });
        return '';
      });
      recordFailure('reddit', classifyError(new Error(`HTTP ${res.status}`)));
      throw new Error(`Reddit token exchange failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
    recordSuccess('reddit');
    return res.json() as Promise<RedditTokenResponse>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('reddit', classifyError(error));
    throw error;
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<RedditTokenResponse> {
  if (!shouldAllowRequest('reddit')) {
    throw new Error('[Reddit] Circuit breaker open for reddit');
  }
  try {
    const res = await fetch(REDDIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SophiaAIFactory/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read Reddit token refresh response', { error: String(err), context: 'refreshAccessToken' });
        return '';
      });
      recordFailure('reddit', classifyError(new Error(`HTTP ${res.status}`)));
      throw new Error(`Reddit token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
    recordSuccess('reddit');
    return res.json() as Promise<RedditTokenResponse>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('reddit', classifyError(error));
    throw error;
  }
}

export async function getUserInfo(accessToken: string): Promise<RedditUserInfo> {
  if (!shouldAllowRequest('reddit')) {
    throw new Error('[Reddit] Circuit breaker open for reddit');
  }
  try {
    const res = await fetch(REDDIT_ME_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'SophiaAIFactory/1.0',
      },
    });
    if (!res.ok) {
      recordFailure('reddit', classifyError(new Error(`HTTP ${res.status}`)));
      throw new Error(`Reddit /me failed: HTTP ${res.status}`);
    }
    recordSuccess('reddit');
    const data = (await res.json()) as { id?: string; name?: string };
    if (!data.id || !data.name) throw new Error('Reddit /me returned no id/name');
    return { id: data.id, name: data.name };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('reddit', classifyError(error));
    throw error;
  }
}
