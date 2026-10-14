/**
 * Instagram Publisher Adapter
 * Uses Instagram Graph API (Business accounts only).
 * Falls back to mock 200 responses when INSTAGRAM_APP_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  buildCaption,
  createMediaContainer,
  fetchMediaInsights,
  fetchMediaStatusCode,
  isMockMode,
  publishContainer,
} from './instagram-graph-api';

const EMPTY_METRICS: MetricsJson = { views: 0, likes: 0, comments: 0 };

export class InstagramPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    private readonly igUserId: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[InstagramPublisher] Mock mode — INSTAGRAM_APP_ID missing');
      return `mock_instagram_${Date.now()}`;
    }

    if (!shouldAllowRequest('instagram')) {
      throw new Error('Circuit breaker open for instagram');
    }

    try {
      const containerId = await createMediaContainer(
        this.igUserId,
        this.accessToken,
        videoUrl,
        buildCaption(meta),
      );
      const publishedId = await publishContainer(this.igUserId, this.accessToken, containerId);
      recordSuccess('instagram');
      return publishedId;
    } catch (error) {
      recordFailure('instagram', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (!shouldAllowRequest('instagram')) return 'processing';
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

    try {
      const code = await fetchMediaStatusCode(externalPostId, this.accessToken);
      if (code === null) return 'processing';
      recordSuccess('instagram');

      if (code === 'FINISHED' || code === 'PUBLISHED') return 'live';
      if (code === 'ERROR') return 'failed';
      return 'processing';
    } catch (error) {
      recordFailure('instagram', classifyError(error));
      return 'processing';
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (!shouldAllowRequest('instagram')) return { ...EMPTY_METRICS };
    if (isMockMode() || externalPostId.startsWith('mock_')) return { ...EMPTY_METRICS };

    try {
      const data = await fetchMediaInsights(externalPostId, this.accessToken);
      if (!data) return { ...EMPTY_METRICS };
      recordSuccess('instagram');

      const find = (name: string) =>
        data.data?.find((m) => m.name === name)?.values?.[0]?.value ?? 0;

      return {
        views: find('impressions'),
        reach: find('reach'),
        likes: find('likes'),
        comments: find('comments'),
        shares: find('shares'),
      };
    } catch (error) {
      recordFailure('instagram', classifyError(error));
      return { ...EMPTY_METRICS };
    }
  }

  async delete(_postId: string): Promise<void> {
    // Platform-specific deletion not implemented
    logger.warn('[instagram-publisher.ts] delete not implemented');
  }
}
