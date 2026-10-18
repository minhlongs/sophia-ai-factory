/**
 * Reddit OAuth 2.0 HTTP transport and circuit-breaker wrappers.
 * @module forest/publishing/reddit-oauth-http
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

export const SERVICE_NAME = 'reddit-oauth';
export const REDDIT_AUTHORIZE = 'https://www.reddit.com/api/v1/authorize';
export const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
export const REDDIT_ME_URL = 'https://oauth.reddit.com/api/v1/me';

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

export function basicAuthHeader(): string {
  const id = process.env.REDDIT_CLIENT_ID ?? '';
  const secret = process.env.REDDIT_CLIENT_SECRET ?? '';
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

export async function postRedditTokenRequest(
  params: URLSearchParams,
  context: 'exchangeCodeForTokens' | 'refreshAccessToken',
  errorLabel: string,
): Promise<RedditTokenResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  try {
    const res = await fetch(REDDIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SophiaAIFactory/1.0',
      },
      body: params,
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn(`Failed to read Reddit ${errorLabel} response`, { error: String(err), context });
        return '';
      });
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      throw new Error(`Reddit ${errorLabel} failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
    recordSuccess(SERVICE_NAME);
    return res.json() as Promise<RedditTokenResponse>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('[circuit-breaker]')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}
