/**
 * OAuth token refresh and caption formatting helpers for Threads Publisher.
 * @module land/video/publishing/providers/threads-helpers
 */

import type { PublishMeta } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

export const THREADS_BASE = 'https://graph.threads.net/v1.0';
const THREADS_LONG_LIVED_URL = 'https://graph.threads.net/access_token';

export interface ThreadsTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  user_id?: string;
}

export interface ThreadsCreateResponse {
  id?: string;
  error?: { message?: string };
}

export interface ThreadsInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>;
}

export function buildThreadsCaption(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ? `\n\n${meta.productLink}` : '';
  return `${adCaption}${tags ? ` ${tags}` : ''}${link}`.slice(0, 500);
}

/**
 * Refresh a Threads long-lived token via th_exchange_token grant (60d TTL).
 */
export async function refreshLongLivedToken(currentToken: string): Promise<ThreadsTokenResponse> {
  const appSecret = process.env.THREADS_APP_SECRET ?? '';

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
      logger.warn('Failed to read Threads token refresh response', {
        error: String(err),
        context: 'refreshLongLivedToken',
      });
      return '';
    });
    throw new Error(`Threads token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<ThreadsTokenResponse>;
}
