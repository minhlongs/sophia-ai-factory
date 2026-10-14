/**
 * Reddit Publisher OAuth & Helper Utilities
 *
 * @module land/video/publishing/providers/reddit-auth
 */

import { logger } from '@/seed/utils/logger-utility';
import type { PublishMeta } from './publisher-interface';

export const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
export const REDDIT_SUBMIT = `${REDDIT_OAUTH_BASE}/api/submit`;
export const REDDIT_USER_AGENT = 'SophiaAIFactory/1.0';

export function isMockMode(): boolean {
  return !process.env.REDDIT_CLIENT_ID;
}

export interface RedditSubmitResponse {
  json?: {
    errors?: string[][];
    data?: { id?: string; name?: string; url?: string };
  };
}

export interface RedditPostResponse {
  data?: { name?: string; is_video?: boolean; score?: number; num_comments?: number; ups?: number };
}

export function buildTitle(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  return adCaption.slice(0, 300);
}

export interface RedditTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in: number;
  scope?: string;
}

/**
 * Refresh Reddit access token via OAuth2.
 * Uses HTTP Basic auth with client_id:client_secret.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RedditTokenResponse> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error('REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / NEXT_PUBLIC_APP_URL not set');
  }

  const res = await fetch(REDDIT_OAUTH_BASE + '/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      redirect_uri: `${appUrl}/api/oauth/reddit/callback`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch((err) => {
      logger.warn('Failed to read Reddit token refresh response', { error: String(err), context: 'refreshAccessToken' });
      return '';
    });
    throw new Error(`Reddit token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<RedditTokenResponse>;
}
