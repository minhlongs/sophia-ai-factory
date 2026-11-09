import type { PublishParams, PublishResult } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  fetchTikTokCreatorInfo,
  resolveTikTokPublishPlan,
  isDurationAllowed,
  logPublishDowngrade,
} from '@/tree/social/publisher/tiktok-creator-info';

export const TT_API = 'https://open.tiktokapis.com/v2';

export { TIKTOK_CREATOR_INFO_ENDPOINT } from '@/tree/social/publisher/tiktok-creator-info';

export async function uploadTikTokVideo(
  accessToken: string,
  params: PublishParams,
): Promise<PublishResult> {
  if (!shouldAllowRequest('tiktok')) {
    throw new Error('[TikTok] Circuit breaker open for tiktok');
  }
  try {
    // TikTok answers an unaudited publish with HTTP 200 and a SELF_ONLY post,
    // so the creator's own capability report decides the privacy level.
    const capabilities = await fetchTikTokCreatorInfo(accessToken);
    if (
      typeof params.durationSeconds === 'number' &&
      !isDurationAllowed(capabilities, params.durationSeconds)
    ) {
      throw new Error(
        `[tiktok-adapter] Video duration (${params.durationSeconds}s) exceeds creator max_video_post_duration_sec (${capabilities.maxVideoDurationSeconds}s)`,
      );
    }
    const plan = resolveTikTokPublishPlan({
      capabilities,
      requested: params.privacy === 'public' ? 'public' : 'private',
      onUnavailable: 'downgrade',
    });
    if (plan.downgraded) {
      logPublishDowngrade({ channelId: params.channelId ?? 'unknown', plan });
    }

    const videoRes = await fetch(params.videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to fetch video from ${params.videoUrl}`);
    const videoBuffer = await videoRes.arrayBuffer();

    const initRes = await fetch(`${TT_API}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: params.title,
          privacy_level: plan.privacyLevel,
          disable_duet: plan.disableDuet,
          disable_comment: plan.disableComment,
          disable_stitch: plan.disableStitch,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoBuffer.byteLength,
          chunk_size: videoBuffer.byteLength,
          total_chunk_count: 1,
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`TikTok upload init failed: ${initRes.status} ${err}`);
    }

    const initData = (await initRes.json()) as {
      data: { publish_id: string; upload_url: string };
    };

    const uploadRes = await fetch(initData.data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${videoBuffer.byteLength - 1}/${videoBuffer.byteLength}`,
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`TikTok upload failed: ${uploadRes.status} ${err}`);
    }

    recordSuccess('tiktok');
    logger.info('[tiktok-adapter] Upload initiated', { publishId: initData.data.publish_id });

    return {
      platformVideoId: initData.data.publish_id,
      status: 'processing',
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('tiktok', classifyError(error));
    throw error;
  }
}
