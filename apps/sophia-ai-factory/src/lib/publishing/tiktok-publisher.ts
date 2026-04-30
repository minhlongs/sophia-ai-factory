/**
 * TikTok Publisher Adapter
 * Wraps existing tiktok-oauth-client for the Publisher interface.
 * Falls back to mock 200 responses when TIKTOK_CLIENT_KEY is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { publishVideo, checkPublishStatus } from '@/lib/tiktok/tiktok-oauth-client';
import { logger } from '@/lib/utils/logger-utility';

function isMockMode(): boolean {
  return !process.env.TIKTOK_CLIENT_KEY;
}

export class TikTokPublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[TikTokPublisher] Mock mode — TIKTOK_CLIENT_KEY missing');
      return `mock_tiktok_${Date.now()}`;
    }

    // FTC compliance: prepend #ad disclosure if not already present
    const rawCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
    const title = rawCaption.slice(0, 150);

    const publishId = await publishVideo({
      accessToken: this.accessToken,
      videoUrl,
      title,
    });
    return publishId;
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return 'live';
    }

    const result = await checkPublishStatus(this.accessToken, externalPostId);
    const s = result.status.toUpperCase();

    if (s === 'PUBLISH_COMPLETE' || s === 'SUCCESS') return 'live';
    if (s === 'FAILED' || s === 'ERROR') return 'failed';
    return 'processing';
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    // TikTok metrics API requires additional scope — return placeholder
    return { views: 0, likes: 0, comments: 0, shares: 0, _note: 'metrics_pending_scope' };
  }
}
