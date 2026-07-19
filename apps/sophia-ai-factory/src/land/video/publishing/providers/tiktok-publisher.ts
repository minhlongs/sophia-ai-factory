/**
 * TikTok Publisher Adapter
 * Wraps existing tiktok-oauth-client for the Publisher interface.
 * Falls back to mock responses when TIKTOK_CLIENT_KEY is absent.
 */

import type { Publisher, PublishMeta, PublishResult, PublishStatus, MetricsJson } from './publisher-interface';
import { publishVideo, checkPublishStatus } from '@/land/tiktok/tiktok-oauth-client';
import { logger } from '@/seed/utils/logger-utility';

function isMockMode(): boolean {
  return !process.env.TIKTOK_CLIENT_KEY;
}

/** Prepend FTC #ad disclosure if caption lacks it (idempotent) */
function withAdPrefix(caption: string): string {
  return caption.startsWith('#ad ') ? caption : `#ad ${caption}`;
}

export class TikTokPublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async publish(videoUrl: string, meta: PublishMeta): Promise<PublishResult> {
    try {
      const publishId = await this.doPublish(videoUrl, meta);
      return { success: true, externalPostId: publishId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  }

  private async doPublish(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[TikTokPublisher] Mock mode — TIKTOK_CLIENT_KEY missing');
      return `mock_tiktok_${Date.now()}`;
    }

    const rawCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
    const title = rawCaption.slice(0, 150);

    const publishId = await publishVideo({
      accessToken: this.accessToken,
      videoUrl,
      title,
    });

    return publishId;
  }

  async getStatus(externalPostId: string): Promise<PublishStatus> {
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

    try {
      const response = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({ publish_id: externalPostId }),
        },
      );

      if (!response.ok) {
        logger.warn('[TikTokPublisher] getMetrics API non-ok', { status: response.status });
        return { views: 0, likes: 0, comments: 0, shares: 0 };
      }

      const body = (await response.json()) as Record<string, unknown>;
      const data = (body.data as Record<string, number | undefined>) ?? {};

      return {
        views: data.views ?? 0,
        likes: data.likes ?? 0,
        comments: data.comments ?? 0,
        shares: data.shares ?? 0,
      };
    } catch (err) {
      logger.warn('[TikTokPublisher] getMetrics fetch error', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
  }

  async delete(postId: string): Promise<void> {
    logger.warn("[tiktok-publisher.ts] delete not implemented", { postId });
  }
}
