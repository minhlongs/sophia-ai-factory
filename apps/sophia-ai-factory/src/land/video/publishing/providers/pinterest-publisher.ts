/**
 * Pinterest Publisher Adapter
 * Uses Pinterest API v5 to upload video Pins to a board.
 * Falls back to mock 200 responses when PINTEREST_CLIENT_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { isMockMode, uploadVideoPin, checkPinStatus, fetchPinMetrics } from './pinterest/pinterest-api';

export * from './pinterest/types';

export class PinterestPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    /** Target board ID — required for creating a Pin */
    private readonly boardId: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[PinterestPublisher] Mock mode — PINTEREST_CLIENT_ID missing');
      return `mock_pinterest_${Date.now()}`;
    }

    if (!shouldAllowRequest('pinterest')) {
      logger.warn('[PinterestPublisher] Circuit open — blocking upload');
      throw new Error('Circuit breaker open for pinterest');
    }

    return uploadVideoPin(this.accessToken, this.boardId, videoUrl, meta);
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';
    return checkPinStatus(this.accessToken, externalPostId);
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0 };
    }
    return fetchPinMetrics(this.accessToken, externalPostId);
  }

  async delete(_postId: string): Promise<void> {
    logger.warn('[pinterest-publisher.ts] delete not implemented');
  }
}
