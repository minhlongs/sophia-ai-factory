/**
 * YouTube Publisher Adapter
 * Wraps existing youtube-oauth-client for the Publisher interface.
 * Falls back to mock 200 responses when YOUTUBE_CLIENT_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  YOUTUBE_VIDEOS_URL,
  isYouTubeMockMode,
  performResumableYouTubeUpload,
  type YouTubeVideoResource,
} from './youtube-upload-helper';

export class YouTubePublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isYouTubeMockMode()) {
      logger.warn('[YouTubePublisher] Mock mode — YOUTUBE_CLIENT_ID missing');
      return `mock_youtube_${Date.now()}`;
    }

    if (!shouldAllowRequest('youtube')) {
      throw new Error('Circuit breaker open for YouTube — too many failures');
    }

    try {
      const videoId = await performResumableYouTubeUpload(this.accessToken, videoUrl, meta);
      recordSuccess('youtube');
      return videoId;
    } catch (error) {
      recordFailure('youtube', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isYouTubeMockMode() || externalPostId.startsWith('mock_')) return 'live';

    if (!shouldAllowRequest('youtube')) return 'processing';

    try {
      const res = await fetch(
        `${YOUTUBE_VIDEOS_URL}?part=status&id=${encodeURIComponent(externalPostId)}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );

      if (!res.ok) return 'processing';

      const data = (await res.json()) as { items?: YouTubeVideoResource[] };
      const item = data.items?.[0];
      const uploadStatus = item?.status?.uploadStatus;

      if (uploadStatus === 'processed') { recordSuccess('youtube'); return 'live'; }
      if (uploadStatus === 'failed' || uploadStatus === 'rejected') return 'failed';
      return 'processing';
    } catch (error) {
      recordFailure('youtube', classifyError(error));
      return 'processing';
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isYouTubeMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0 };
    }

    if (!shouldAllowRequest('youtube')) {
      return { views: 0, likes: 0, comments: 0 };
    }

    try {
      const res = await fetch(
        `${YOUTUBE_VIDEOS_URL}?part=statistics&id=${encodeURIComponent(externalPostId)}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );

      if (!res.ok) return { views: 0, likes: 0, comments: 0 };

      const data = (await res.json()) as { items?: YouTubeVideoResource[] };
      const stats = data.items?.[0]?.statistics;

      recordSuccess('youtube');
      return {
        views: Number(stats?.viewCount ?? 0),
        likes: Number(stats?.likeCount ?? 0),
        comments: Number(stats?.commentCount ?? 0),
      };
    } catch (error) {
      recordFailure('youtube', classifyError(error));
      return { views: 0, likes: 0, comments: 0 };
    }
  }

  async delete(_postId: string): Promise<void> {
    // Platform-specific deletion not implemented
    logger.warn('[youtube-publisher.ts] delete not implemented');
  }
}
