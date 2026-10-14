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
import {
  THREADS_BASE,
  buildThreadsCaption,
  refreshLongLivedToken,
  type ThreadsTokenResponse,
  type ThreadsCreateResponse,
  type ThreadsInsightsResponse,
} from './threads-helpers';

export { refreshLongLivedToken, type ThreadsTokenResponse };

function isMockMode(): boolean {
  return !process.env.THREADS_APP_ID;
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
      const text = buildThreadsCaption(meta);

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
    if (!shouldAllowRequest('threads')) return 'processing';

    try {
      const res = await fetch(
        `${THREADS_BASE}/${externalPostId}?fields=id,status&access_token=${this.accessToken}`,
      );
      if (res.status === 404 || !res.ok) return 'failed';
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
        const v = data.data?.find((m) => m.name === name)?.values?.[0]?.value;
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

  async delete(_postId: string): Promise<void> {
    logger.warn('[threads.ts] delete not implemented');
  }
}
