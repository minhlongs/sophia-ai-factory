/**
 * Threads OAuth 2.0 helpers via graph.threads.net.
 * Separate Meta app from Facebook — uses THREADS_APP_ID / THREADS_APP_SECRET.
 * Long-lived tokens last 60 days; standard th_exchange_token re-exchange for refresh.
 *
 * Security: client_secret sent via POST body (not URL query) for token exchanges.
 * getUserInfo uses Authorization header (not ?access_token= query param).
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

const SERVICE_NAME = 'threads-oauth';
const THREADS_DIALOG = 'https://threads.net/oauth/authorize';
const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const THREADS_LONG_LIVED_URL = 'https://graph.threads.net/access_token';
const THREADS_USER_URL = 'https://graph.threads.net/v1.0/me';

export const THREADS_SCOPES = ['threads_basic', 'threads_content_publish', 'threads_manage_insights'];

export interface ThreadsTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  user_id?: string;
}

export interface ThreadsUserInfo {
  id: string;
  username?: string;
  name?: string;
}

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
    // Step 1: short-lived token via POST body (no secret in URL)
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
      const body = await shortRes.text().catch((err) => {
        logger.warn('Failed to read Threads short-lived exchange response', { error: String(err), context: 'exchangeCodeForTokens' });
        return '';
      });
      recordFailure(SERVICE_NAME, classifyHttpStatus(shortRes.status));
      throw new Error(`Threads short-lived exchange failed: HTTP ${shortRes.status} — ${body.slice(0, 200)}`);
    }
    const short = (await shortRes.json()) as ThreadsTokenResponse;
    if (!short.access_token) throw new Error('Threads: no short-lived access_token');

    // Step 2: exchange for long-lived (60d) via POST body (secret not in URL)
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
      const body = await longRes.text().catch((err) => {
        logger.warn('Failed to read Threads long-lived exchange response', { error: String(err), context: 'exchangeCodeForTokens' });
        return '';
      });
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

export async function refreshLongLivedToken(currentToken: string): Promise<ThreadsTokenResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  const appSecret = process.env.THREADS_APP_SECRET ?? '';
  try {
    // Refresh via POST body (secret not in URL)
    const res = await fetch(THREADS_LONG_LIVED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'th_refresh_token',
        access_token: currentToken,
        client_secret: appSecret,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read Threads token refresh response', { error: String(err), context: 'refreshLongLivedToken' });
        return '';
      });
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      throw new Error(`Threads token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
    recordSuccess(SERVICE_NAME);
    return res.json() as Promise<ThreadsTokenResponse>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('[circuit-breaker]')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}

export async function getUserInfo(accessToken: string): Promise<ThreadsUserInfo> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  try {
    // Use Authorization header — avoid exposing token in URL (browser logs, Referer)
    const res = await fetch(`${THREADS_USER_URL}?fields=id,username,name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      throw new Error(`Threads /me failed: HTTP ${res.status}`);
    }
    recordSuccess(SERVICE_NAME);
    const data = (await res.json()) as ThreadsUserInfo;
    if (!data.id) throw new Error('Threads /me returned no id');
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('[circuit-breaker]')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}
