import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from '../publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { isMockMode } from './types';
import { uploadVideoBinary } from './media-uploader';
import { createLinkedInPost } from './post-creator';
import { checkPostStatus, fetchPostMetrics } from './metrics-poller';

export class LinkedInPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    /** LinkedIn member URN e.g. "urn:li:person:ABC123" */
    private readonly authorUrn: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[LinkedInPublisher] Mock mode — LINKEDIN_CLIENT_ID missing');
      return `mock_linkedin_${Date.now()}`;
    }

    if (!shouldAllowRequest('linkedin')) {
      throw new Error('[LinkedInPublisher] Circuit breaker open for linkedin');
    }

    try {
      const { assetUrn } = await uploadVideoBinary(videoUrl, this.accessToken, this.authorUrn);
      const postId = await createLinkedInPost(this.accessToken, this.authorUrn, assetUrn, meta);
      recordSuccess('linkedin');
      return postId;
    } catch (error) {
      recordFailure('linkedin', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

    if (!shouldAllowRequest('linkedin')) return 'processing';

    try {
      const status = await checkPostStatus(this.accessToken, externalPostId);
      recordSuccess('linkedin');
      return status;
    } catch (error) {
      recordFailure('linkedin', classifyError(error));
      return 'processing';
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    if (!shouldAllowRequest('linkedin')) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    try {
      const metrics = await fetchPostMetrics(this.accessToken, externalPostId);
      recordSuccess('linkedin');
      return metrics;
    } catch (error) {
      recordFailure('linkedin', classifyError(error));
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
  }

  async delete(_postId: string): Promise<void> {
    logger.warn('[linkedin-publisher.ts] delete not implemented');
  }
}
