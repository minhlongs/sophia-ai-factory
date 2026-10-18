/**
 * Threads OAuth 2.0 helpers via graph.threads.net.
 * Separate Meta app from Facebook — uses THREADS_APP_ID / THREADS_APP_SECRET.
 * Long-lived tokens last 60 days; standard th_exchange_token re-exchange for refresh.
 *
 * Security: client_secret sent via POST body (not URL query) for token exchanges.
 * getUserInfo uses Authorization header (not ?access_token= query param).
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  SERVICE_NAME,
  THREADS_DIALOG,
  THREADS_TOKEN_URL,
  THREADS_LONG_LIVED_URL,
  THREADS_SCOPES,
  readThreadsErrorBody,
  refreshLongLivedToken,
  getUserInfo,
  type ThreadsTokenResponse,
  type ThreadsUserInfo,
} from './threads-oauth-types';

export {
  THREADS_SCOPES,
  refreshLongLivedToken,
  getUserInfo,
  type ThreadsTokenResponse,
  type ThreadsUserInfo,
};

export function getAuthorizationUrl(state: string): string {
  const appId = process.env.THREADS_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appId || !appUrl) throw new Error('THREADS_APP_ID / NEXT_PUBLIC_APP_URL not set');
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: `${appUrl}/api/oauth/threads/callback`,
    scope: THREADS_SCOPES.join(','),
    response_type: 'code',
    state,
  });
  return `${THREADS_DIALOG}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<ThreadsTokenResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  const appId = process.env.THREADS_APP_ID ?? '';
  const appSecret = process.env.THREADS_APP_SECRET ?? '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  try {
    const shortRes = await fetch(THREADS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${appUrl}/api/oauth/threads/callback`,
      }),
    });
    if (!shortRes.ok) {
      const body = await readThreadsErrorBody(
        shortRes,
        'Failed to read Threads short-lived exchange response',
        'exchangeCodeForTokens',
      );
      recordFailure(SERVICE_NAME, classifyHttpStatus(shortRes.status));
      throw new Error(`Threads short-lived exchange failed: HTTP ${shortRes.status} — ${body.slice(0, 200)}`);
    }
    const short = (await shortRes.json()) as ThreadsTokenResponse;
    if (!short.access_token) throw new Error('Threads: no short-lived access_token');

    const longRes = await fetch(THREADS_LONG_LIVED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'th_exchange_token',
        client_secret: appSecret,
        access_token: short.access_token,
      }),
    });
    if (!longRes.ok) {
      const body = await readThreadsErrorBody(
        longRes,
        'Failed to read Threads long-lived exchange response',
        'exchangeCodeForTokens',
      );
      recordFailure(SERVICE_NAME, classifyHttpStatus(longRes.status));
      throw new Error(`Threads long-lived exchange failed: HTTP ${longRes.status} — ${body.slice(0, 200)}`);
    }
    recordSuccess(SERVICE_NAME);
    return longRes.json() as Promise<ThreadsTokenResponse>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('[circuit-breaker]')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}
