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
  refreshLongLivedToken,
  type ThreadsTokenResponse,
  type ThreadsInsightsResponse,
} from './threads-helpers';
import {
  createAndPublishThreadsContainer,
  parseThreadsInsights,
} from './threads-api-client';

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
      const postId = await createAndPublishThreadsContainer(
        this.userId,
        this.accessToken,
        videoUrl,
        meta,
      );
      recordSuccess('threads');
      return postId;
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
      return parseThreadsInsights(data);
    } catch (error) {
      recordFailure('threads', classifyError(error));
      throw error;
    }
  }

  async delete(_postId: string): Promise<void> {
    logger.warn('[threads.ts] delete not implemented');
  }
}
