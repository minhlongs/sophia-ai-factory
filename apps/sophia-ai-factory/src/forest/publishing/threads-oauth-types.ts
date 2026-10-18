/**
 * Threads OAuth 2.0 constants, response types, and token refresh/user helpers.
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

export const SERVICE_NAME = 'threads-oauth';
export const THREADS_DIALOG = 'https://threads.net/oauth/authorize';
export const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
export const THREADS_LONG_LIVED_URL = 'https://graph.threads.net/access_token';
export const THREADS_USER_URL = 'https://graph.threads.net/v1.0/me';

export const THREADS_SCOPES = [
  'threads_basic',
  'threads_content_publish',
  'threads_manage_insights',
];

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

export async function readThreadsErrorBody(
  res: Response,
  label: string,
  context: string,
): Promise<string> {
  return res.text().catch((err) => {
    logger.warn(label, { error: String(err), context });
    return '';
  });
}

export async function refreshLongLivedToken(currentToken: string): Promise<ThreadsTokenResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  const appSecret = process.env.THREADS_APP_SECRET ?? '';
  try {
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
      const body = await readThreadsErrorBody(
        res,
        'Failed to read Threads token refresh response',
        'refreshLongLivedToken',
      );
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
