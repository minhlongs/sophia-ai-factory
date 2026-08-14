/**
 * TikTok Publisher Adapter
 * Wraps existing tiktok-oauth-client for the Publisher interface.
 * Falls back to mock 200 responses when TIKTOK_CLIENT_KEY is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { publishVideo, checkPublishStatus } from '@/land/tiktok/tiktok-oauth-client';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

function isMockMode(): boolean {
  return !process.env.TIKTOK_CLIENT_KEY;
}

/** Prepend FTC #ad disclosure if caption lacks it (idempotent) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for FTC #ad disclosure compliance
function withAdPrefix(caption: string): string {
  return caption.startsWith('#ad ') ? caption : `#ad ${caption}`;
}

export class TikTokPublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[TikTokPublisher] Mock mode — TIKTOK_CLIENT_KEY missing');
      return `mock_tiktok_${Date.now()}`;
    }

    if (!shouldAllowRequest('tiktok')) {
      throw new Error('Circuit breaker open for TikTok — too many failures');
    }

    try {
      // FTC compliance: prepend #ad disclosure if not already present
      const rawCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
      const title = rawCaption.slice(0, 150);

      const publishId = await publishVideo({
        accessToken: this.accessToken,
        videoUrl,
        title,
      });
      recordSuccess('tiktok');
      return publishId;
    } catch (error) {
      const kind = classifyError(error);
      recordFailure('tiktok', kind);
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return 'live';
    }

    if (!shouldAllowRequest('tiktok')) return 'processing';

    try {
      const result = await checkPublishStatus(this.accessToken, externalPostId);
      const s = result.status.toUpperCase();

      if (s === 'PUBLISH_COMPLETE' || s === 'SUCCESS') return 'live';
      if (s === 'FAILED' || s === 'ERROR') return 'failed';
      recordSuccess('tiktok');
      return 'processing';
    } catch (error) {
      const kind = classifyError(error);
      recordFailure('tiktok', kind);
      throw error;
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    if (!shouldAllowRequest('tiktok')) return { views: 0, likes: 0, comments: 0 };

    try {
      // TikTok metrics API requires additional scope — return placeholder
      recordSuccess('tiktok');
      return { views: 0, likes: 0, comments: 0, shares: 0, _note: 'metrics_pending_scope' };
    } catch (error) {
      const kind = classifyError(error);
      recordFailure('tiktok', kind);
      throw error;
    }
  }

async delete(_postId: string): Promise<void> {
  // Platform-specific deletion not implemented
  logger.warn("[tiktok-publisher.ts] delete not implemented");
}}
