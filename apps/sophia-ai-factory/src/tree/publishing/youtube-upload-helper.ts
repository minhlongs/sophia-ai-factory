import { shouldAllowRequest, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { PublishParams, PublishResult } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';

const YT_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';

export async function uploadYoutubeVideo(
  accessToken: string,
  params: PublishParams,
): Promise<PublishResult> {
  if (!shouldAllowRequest('youtube')) {
    throw new Error('[youtube-adapter] Circuit breaker open for youtube');
  }
  try {
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

    // Step 1: Initiate resumable upload
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
      throw new Error(`YouTube upload init failed: ${initRes.status} ${err}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) throw new Error('YouTube did not return upload URL');

    // Step 2: Upload video bytes
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
      throw new Error(`YouTube upload failed: ${uploadRes.status} ${err}`);
    }

    const result = await uploadRes.json() as { id: string; status?: { uploadStatus?: string } };

    logger.info('[youtube-adapter] Upload complete', {
      platformVideoId: result.id,
      status: result.status?.uploadStatus,
    });

    return {
      platformVideoId: result.id,
      status: 'processing',
      url: `https://www.youtube.com/watch?v=${result.id}`,
    };
  } catch (err) {
    const kind = classifyError(err);
    recordFailure('youtube', kind);
    throw err;
  }
}
