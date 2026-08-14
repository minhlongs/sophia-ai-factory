/**
 * YouTube Publisher Adapter
 * Wraps existing youtube-oauth-client for the Publisher interface.
 * Falls back to mock 200 responses when YOUTUBE_CLIENT_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
function isMockMode(): boolean { return !process.env.YOUTUBE_CLIENT_ID; }

interface YouTubeVideoResource {
  id: string;
  status?: { uploadStatus?: string; privacyStatus?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

export class YouTubePublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[YouTubePublisher] Mock mode — YOUTUBE_CLIENT_ID missing');
      return `mock_youtube_${Date.now()}`;
    }

    if (!shouldAllowRequest('youtube')) {
      throw new Error('Circuit breaker open for YouTube — too many failures');
    }

    try {
    // Fetch video binary
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to fetch video: ${videoRes.status}`);
    const videoBlob = await videoRes.blob();
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

    const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
        const description = `${adCaption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`;

    const metadata = {
      snippet: {
        title: (meta.title ?? meta.caption).slice(0, 100),
        description: description.slice(0, 5000),
        tags: meta.hashtags.slice(0, 500),
        categoryId: '22',
      },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    };

    // Initiate resumable upload
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(videoBlob.size),
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!initRes.ok) {
      const text = await initRes.text();
      throw new Error(`YouTube upload init failed (${initRes.status}): ${text}`);
    }

    const uploadUri = initRes.headers.get('Location');
    if (!uploadUri) throw new Error('YouTube did not return resumable upload URI');

    const uploadRes = await fetch(uploadUri, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Content-Length': String(videoBlob.size) },
      body: videoBlob,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`YouTube video upload failed (${uploadRes.status}): ${text}`);
    }

    const result = (await uploadRes.json()) as YouTubeVideoResource;
    recordSuccess('youtube');
    return result.id;
    } catch (error) {
      recordFailure('youtube', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

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
    if (isMockMode() || externalPostId.startsWith('mock_')) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async delete(postId: string): Promise<void> {
  // Platform-specific deletion not implemented
  logger.warn("[youtube-publisher.ts] delete not implemented");
}}
