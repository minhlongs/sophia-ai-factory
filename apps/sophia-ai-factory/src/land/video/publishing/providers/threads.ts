/**
 * Threads Publisher Adapter — Meta Graph API via graph.threads.net.
 * Two-step publish: create media container → publish container.
 * Supports video (VIDEO type) and link posts (TEXT type with link).
 * Falls back to mock responses when THREADS_APP_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const THREADS_BASE = 'https://graph.threads.net/v1.0';
const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const THREADS_LONG_LIVED_URL = 'https://graph.threads.net/access_token';

export interface ThreadsTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  user_id?: string;
}

function isMockMode(): boolean {
  return !process.env.THREADS_APP_ID;
}

interface ThreadsCreateResponse { id?: string; error?: { message?: string } }
interface ThreadsInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>
}

function buildCaption(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ? `\n\n${meta.productLink}` : '';
  return `${adCaption}${tags ? ` ${tags}` : ''}${link}`.slice(0, 500);
}

/**
 * Refresh a Threads long-lived token via th_exchange_token grant (60d TTL).
 * This is a standalone OAuth helper function for token refresh operations.
 */
export async function refreshLongLivedToken(currentToken: string): Promise<ThreadsTokenResponse> {
  const appSecret = process.env.THREADS_APP_SECRET ?? '';

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
    throw new Error(`Threads token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<ThreadsTokenResponse>;
}

export class ThreadsPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    private readonly userId: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[ThreadsPublisher] Mock mode — THREADS_APP_ID missing');
      return `mock_threads_${Date.now()}`;
    }

    if (!shouldAllowRequest('threads')) {
      throw new Error('Circuit breaker open for Threads — request blocked');
    }

    try {
      const text = buildCaption(meta);

      // Step 1: Create media container
      const containerRes = await fetch(`${THREADS_BASE}/${this.userId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'VIDEO',
          video_url: videoUrl,
          text,
          access_token: this.accessToken,
        }),
      });
      if (!containerRes.ok) {
        const body = await containerRes.text().catch((err) => {
          logger.warn('Failed to read Threads container response', { error: String(err), context: 'ThreadsPublisher.upload' });
          return '';
        });
        throw new Error(`Threads container creation failed (${containerRes.status}): ${body.slice(0, 300)}`);
      }
      const containerData = (await containerRes.json()) as ThreadsCreateResponse;
      if (!containerData.id) {
        throw new Error(`Threads container returned no id: ${containerData.error?.message ?? 'unknown'}`);
      }

      // Step 2: Publish container
      const publishRes = await fetch(`${THREADS_BASE}/${this.userId}/threads_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: this.accessToken,
        }),
      });
      if (!publishRes.ok) {
        const body = await publishRes.text().catch((err) => {
          logger.warn('Failed to read Threads publish response', { error: String(err), context: 'ThreadsPublisher.upload' });
          return '';
        });
        throw new Error(`Threads publish failed (${publishRes.status}): ${body.slice(0, 300)}`);
      }
      const publishData = (await publishRes.json()) as ThreadsCreateResponse;
      if (!publishData.id) {
        throw new Error(`Threads publish returned no post id: ${publishData.error?.message ?? 'unknown'}`);
      }
      recordSuccess('threads');
      return publishData.id;
    } catch (error) {
      recordFailure('threads', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';
    // Fail-soft: circuit open → treat as still processing
    if (!shouldAllowRequest('threads')) return 'processing';

    try {
      // Threads publishes synchronously — if post exists it's live
      const res = await fetch(
        `${THREADS_BASE}/${externalPostId}?fields=id,status&access_token=${this.accessToken}`,
      );
      if (res.status === 404) return 'failed';
      if (!res.ok) return 'failed';
      recordSuccess('threads');
      return 'live';
    } catch (error) {
      recordFailure('threads', classifyError(error));
      throw error;
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0 };
    }
    // Fail-soft: circuit open → return zero metrics
    if (!shouldAllowRequest('threads')) return { views: 0, likes: 0, comments: 0 };

    try {
      const metrics = 'views,likes,replies';
      const res = await fetch(
        `${THREADS_BASE}/${externalPostId}/insights?metric=${metrics}&access_token=${this.accessToken}`,
      );
      if (!res.ok) return { views: 0, likes: 0, comments: 0 };
      recordSuccess('threads');
      const data = (await res.json()) as ThreadsInsightsResponse;
      const findNum = (name: string): number => {
        const v = data.data?.find(m => m.name === name)?.values?.[0]?.value;
        return typeof v === 'number' ? v : 0;
      };
      return {
        views: findNum('views'),
        likes: findNum('likes'),
        comments: findNum('replies'),
      };
    } catch (error) {
      recordFailure('threads', classifyError(error));
      throw error;
    }
  }

async delete(postId: string): Promise<void> {
  // Platform-specific deletion not implemented
  logger.warn("[threads.ts] delete not implemented");
}}