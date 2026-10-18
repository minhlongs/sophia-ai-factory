import type { PlatformAdapter, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { TT_API, uploadTikTokVideo } from './tiktok-upload-helper';

const TT_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

export const tiktokAdapter: PlatformAdapter = {
  platform: 'tiktok',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
    return uploadTikTokVideo(accessToken, params);
  },

  async checkStatus(
    accessToken: string,
    platformVideoId: string,
  ): Promise<{ status: PublishStatus; error?: string }> {
    if (!shouldAllowRequest('tiktok')) {
      return { status: 'failed', error: 'TikTok circuit breaker open' };
    }
    try {
      const res = await fetch(`${TT_API}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publish_id: platformVideoId }),
      });

      if (!res.ok) {
        recordFailure('tiktok', classifyError(new Error(`HTTP ${res.status}`)));
        return { status: 'failed', error: `TikTok API ${res.status}` };
      }

      recordSuccess('tiktok');
      const data = await res.json() as {
        data: { status: string; fail_reason?: string };
      };

      const statusMap: Record<string, PublishStatus> = {
        PROCESSING_UPLOAD: 'uploading',
        PROCESSING_DOWNLOAD: 'processing',
        SEND_TO_USER_INBOX: 'published',
        PUBLISH_COMPLETE: 'published',
        FAILED: 'failed',
      };

      return {
        status: statusMap[data.data.status] ?? 'processing',
        error: data.data.fail_reason,
      };
    } catch (error) {
      recordFailure('tiktok', classifyError(error));
      return { status: 'failed', error: classifyError(error) as string };
    }
  },

  async refreshToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!shouldAllowRequest('tiktok')) {
      throw new Error('[TikTok] Circuit breaker open for tiktok');
    }
    try {
      const res = await fetch(TT_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        recordFailure('tiktok', classifyError(new Error(`HTTP ${res.status}`)));
        throw new Error(`TikTok token refresh failed: ${res.status} ${err}`);
      }

      recordSuccess('tiktok');
      const data = await res.json() as {
        data: { access_token: string; expires_in: number };
      };
      return { accessToken: data.data.access_token, expiresIn: data.data.expires_in };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
      recordFailure('tiktok', classifyError(error));
      throw error;
    }
  },
};
