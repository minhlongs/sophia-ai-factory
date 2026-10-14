import type { PlatformAdapter, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  YT_VIDEOS_URL,
  YT_TOKEN_URL,
  performYouTubeUpload,
  evaluateYouTubeVideoStatus,
} from './youtube-adapter-http';

export const youtubeAdapter: PlatformAdapter = {
  platform: 'youtube',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
    if (!shouldAllowRequest('youtube')) {
      throw new Error('[YouTube] Circuit breaker open for youtube');
    }

    try {
      return await performYouTubeUpload(accessToken, params);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
      recordFailure('youtube', classifyError(error));
      throw error;
    }
  },

  async checkStatus(
    accessToken: string,
    platformVideoId: string,
  ): Promise<{ status: PublishStatus; error?: string }> {
    if (!shouldAllowRequest('youtube')) {
      return { status: 'failed', error: 'YouTube circuit breaker open' };
    }
    try {
      const res = await fetch(
        `${YT_VIDEOS_URL}?id=${platformVideoId}&part=status,processingDetails`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!res.ok) {
        const kind = classifyHttpStatus(res.status);
        recordFailure('youtube', kind);
        return { status: 'failed', error: `YouTube API ${res.status}` };
      }

      recordSuccess('youtube');
      const data = (await res.json()) as {
        items?: Array<{
          status?: { uploadStatus?: string; privacyStatus?: string; publishAt?: string };
          processingDetails?: { processingStatus?: string };
        }>;
      };

      return evaluateYouTubeVideoStatus(data);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
      recordFailure('youtube', classifyError(error));
      return { status: 'failed', error: classifyError(error) as string };
    }
  },

  async refreshToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!shouldAllowRequest('youtube')) {
      throw new Error('[YouTube] Circuit breaker open for youtube');
    }
    try {
      const res = await fetch(YT_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        const kind = classifyHttpStatus(res.status);
        recordFailure('youtube', kind);
        throw new Error(`YouTube token refresh failed: ${res.status} ${err}`);
      }

      recordSuccess('youtube');
      const data = (await res.json()) as { access_token: string; expires_in: number };
      return { accessToken: data.access_token, expiresIn: data.expires_in };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
      recordFailure('youtube', classifyError(error));
      throw error;
    }
  },
};
