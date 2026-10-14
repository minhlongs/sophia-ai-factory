/**
 * YouTube Data API v3 HTTP helpers (resumable upload, status polling, token refresh).
 * @module forest/publishing/youtube-adapter-http
 */

import type { PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';
import { recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus } from '@/seed/types/failure-kind';

export const YT_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
export const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
export const YT_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function performYouTubeUpload(
  accessToken: string,
  params: PublishParams,
): Promise<PublishResult> {
  const metadata = {
    snippet: {
      title: params.title,
      description: params.description,
      tags: params.tags ?? [],
      categoryId: params.categoryId ?? '22',
    },
    status: {
      privacyStatus: params.privacy ?? 'private',
      publishAt: params.scheduledAt ?? undefined,
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    `${YT_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initRes.ok) {
    const err = await initRes.text();
    const initKind = classifyHttpStatus(initRes.status);
    recordFailure('youtube', initKind);
    throw new Error(`YouTube upload init failed: ${initRes.status} ${err}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('YouTube did not return upload URL');

  const videoRes = await fetch(params.videoUrl);
  if (!videoRes.ok) throw new Error(`Failed to fetch video from ${params.videoUrl}`);
  const videoBuffer = await videoRes.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    const kind = classifyHttpStatus(uploadRes.status);
    recordFailure('youtube', kind);
    throw new Error(`YouTube upload failed: ${uploadRes.status} ${err}`);
  }

  recordSuccess('youtube');
  const result = (await uploadRes.json()) as { id: string; status?: { uploadStatus?: string } };

  logger.info('[youtube-adapter] Upload complete', {
    platformVideoId: result.id,
    status: result.status?.uploadStatus,
  });

  return {
    platformVideoId: result.id,
    status: 'processing',
    url: `https://www.youtube.com/watch?v=${result.id}`,
  };
}

export function evaluateYouTubeVideoStatus(data: {
  items?: Array<{
    status?: { uploadStatus?: string; privacyStatus?: string; publishAt?: string };
    processingDetails?: { processingStatus?: string };
  }>;
}): { status: PublishStatus; error?: string } {
  const item = data.items?.[0];
  if (!item) return { status: 'failed', error: 'Video not found on YouTube' };

  const uploadStatus = item.status?.uploadStatus;
  const processingStatus = item.processingDetails?.processingStatus;

  if (uploadStatus === 'rejected' || uploadStatus === 'failed') {
    return { status: 'failed', error: `Upload ${uploadStatus}` };
  }

  if (processingStatus === 'succeeded' || uploadStatus === 'processed') {
    return { status: 'published' };
  }

  return { status: 'processing' };
}
