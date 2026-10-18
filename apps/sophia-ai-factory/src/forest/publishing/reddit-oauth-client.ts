/**
 * Reddit OAuth 2.0 helpers via reddit.com/api/v1.
 * Uses permanent duration tokens (refresh_token never expires server-side).
 * Auth: HTTP Basic (client_id:client_secret) for all token requests.
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  SERVICE_NAME,
  REDDIT_AUTHORIZE,
  REDDIT_ME_URL,
  postRedditTokenRequest,
  type RedditTokenResponse,
  type RedditUserInfo,
} from './reddit-oauth-http';

export type { RedditTokenResponse, RedditUserInfo };

export const REDDIT_SCOPES = ['identity', 'submit', 'read'];

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return postRedditTokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appUrl}/api/oauth/reddit/callback`,
    }),
    'exchangeCodeForTokens',
    'token exchange',
  );
}

export async function refreshAccessToken(refreshToken: string): Promise<RedditTokenResponse> {
  return postRedditTokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    'refreshAccessToken',
    'token refresh',
  );
}

export async function getUserInfo(accessToken: string): Promise<RedditUserInfo> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  try {
    const res = await fetch(REDDIT_ME_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'SophiaAIFactory/1.0',
      },
    });
    if (!res.ok) {
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      throw new Error(`Reddit /me failed: HTTP ${res.status}`);
    }
    recordSuccess(SERVICE_NAME);
    const data = (await res.json()) as { id?: string; name?: string };
    if (!data.id || !data.name) throw new Error('Reddit /me returned no id/name');
    return { id: data.id, name: data.name };
  } catch (error) {
    if (error instanceof Error && error.message.includes('[circuit-breaker]')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}
