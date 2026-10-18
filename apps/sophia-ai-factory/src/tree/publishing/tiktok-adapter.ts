import { shouldAllowRequest, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { PlatformAdapter, PublishParams, PublishResult } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';
import {
  TT_API,
  checkTikTokPublishStatus,
  refreshTikTokAccessToken,
} from './tiktok-status-and-auth';

export const tiktokAdapter: PlatformAdapter = {
  platform: 'tiktok',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
    if (!shouldAllowRequest('tiktok')) {
      throw new Error('[tiktok-adapter] Circuit breaker open for tiktok');
    }
    try {
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
            privacy_level: params.privacy === 'public' ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
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

      logger.info('[tiktok-adapter] Upload initiated', { publishId: initData.data.publish_id });

      return {
        platformVideoId: initData.data.publish_id,
        status: 'processing',
      };
    } catch (err) {
      const kind = classifyError(err);
      recordFailure('tiktok', kind);
      throw err;
    }
  },

  checkStatus: checkTikTokPublishStatus,
  refreshToken: refreshTikTokAccessToken,
};
