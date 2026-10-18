import type { PlatformAdapter, PublishParams, PublishResult } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  IG_SERVICE_NAME,
  IG_API,
  pollInstagramContainerReady,
  checkInstagramMediaStatus,
  refreshInstagramAccessToken,
} from './instagram-api-helpers';

export const instagramAdapter: PlatformAdapter = {
  platform: 'instagram',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
    if (!shouldAllowRequest(IG_SERVICE_NAME)) {
      throw new Error(`[circuit-breaker] Circuit open for ${IG_SERVICE_NAME}`);
    }
    const [igUserId, token] = accessToken.includes(':')
      ? accessToken.split(':', 2)
      : ['me', accessToken];

    try {
      const containerRes = await fetch(`${IG_API}/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: params.videoUrl,
          media_type: 'REELS',
          caption: `${params.title}\n\n${params.description}`,
          share_to_feed: true,
          access_token: token,
        }),
      });

      if (!containerRes.ok) {
        const err = await containerRes.text();
        recordFailure(IG_SERVICE_NAME, classifyHttpStatus(containerRes.status));
        throw new Error(`Instagram container creation failed: ${containerRes.status} ${err}`);
      }

      const container = (await containerRes.json()) as { id: string };
      await pollInstagramContainerReady(container.id, token);

      const publishRes = await fetch(`${IG_API}/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: container.id,
          access_token: token,
        }),
      });

      if (!publishRes.ok) {
        const err = await publishRes.text();
        recordFailure(IG_SERVICE_NAME, classifyHttpStatus(publishRes.status));
        throw new Error(`Instagram publish failed: ${publishRes.status} ${err}`);
      }

      recordSuccess(IG_SERVICE_NAME);
      const result = (await publishRes.json()) as { id: string };

      logger.info('[instagram-adapter] Published', { mediaId: result.id });

      return {
        platformVideoId: result.id,
        status: 'published',
        url: `https://www.instagram.com/reel/${result.id}`,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
      recordFailure(IG_SERVICE_NAME, classifyError(error));
      throw error;
    }
  },

  checkStatus: checkInstagramMediaStatus,

  refreshToken: refreshInstagramAccessToken,
};
