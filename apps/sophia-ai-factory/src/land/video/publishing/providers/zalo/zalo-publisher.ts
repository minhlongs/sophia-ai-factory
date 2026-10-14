/**
 * Zalo Official Account Publisher Adapter implementation.
 * @module land/video/publishing/providers/zalo/zalo-publisher
 */

import type {
  Publisher,
  PublishMeta,
  PublishStatus,
  MetricsJson,
} from '../publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  MAX_CAPTION_LEN,
  ZaloVerificationRequiredError,
  checkMode,
} from './types';
import {
  uploadVideoFile,
  broadcastVideoMessage,
  fetchBroadcastStatistics,
} from './api-client';

export class ZaloPublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    const mode = checkMode();
    if (mode === 'missing') throw new ZaloVerificationRequiredError();
    if (mode === 'mock') {
      logger.warn('[ZaloPublisher] Mock mode — ZALO_OA_ACCESS_TOKEN missing');
      return `mock_zalo_${Date.now()}`;
    }

    if (!shouldAllowRequest('zalo')) {
      throw new Error('Circuit breaker open for Zalo — too many failures');
    }

    try {
      const videoId = await uploadVideoFile(this.accessToken, videoUrl);

      const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
      const caption = `${meta.caption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`.slice(
        0,
        MAX_CAPTION_LEN,
      );

      const publishedId = await broadcastVideoMessage(this.accessToken, videoId, caption);

      recordSuccess('zalo');
      return publishedId;
    } catch (error) {
      const kind = classifyError(error);
      recordFailure('zalo', kind);
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (checkMode() !== 'real' || externalPostId.startsWith('mock_')) return 'live';

    if (!shouldAllowRequest('zalo')) return 'processing';

    try {
      // Zalo broadcasts are synchronously published — if we have an ID, it's live
      recordSuccess('zalo');
      return 'live';
    } catch (error) {
      const kind = classifyError(error);
      recordFailure('zalo', kind);
      return 'processing';
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (checkMode() !== 'real' || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0 };
    }

    if (!shouldAllowRequest('zalo')) return { views: 0, likes: 0 };

    try {
      const stats = await fetchBroadcastStatistics(this.accessToken, externalPostId);
      if (!stats) return { views: 0, likes: 0 };

      recordSuccess('zalo');
      return stats;
    } catch (error) {
      const kind = classifyError(error);
      recordFailure('zalo', kind);
      return { views: 0, likes: 0 };
    }
  }

  async delete(_postId: string): Promise<void> {
    // Platform-specific deletion not implemented
    logger.warn('[ZaloPublisher] delete not implemented');
  }
}
