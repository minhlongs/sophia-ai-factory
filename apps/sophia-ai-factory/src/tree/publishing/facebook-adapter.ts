import { shouldAllowRequest, recordFailure, recordSuccess } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';
import type { PlatformAdapter, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import {
  FB_GRAPH_API,
  FB_TOKEN_URL,
  parseFacebookAccessToken,
  executeFacebookReelsUpload,
} from './facebook-reels-uploader';

export const facebookAdapter: PlatformAdapter = {
  platform: 'facebook',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
    if (!shouldAllowRequest('facebook')) {
      throw new Error('[facebook-adapter] Circuit breaker open for facebook');
    }
    try {
      return await executeFacebookReelsUpload(accessToken, params);
    } catch (err) {
      const kind = classifyError(err);
      recordFailure('facebook', kind);
      throw err;
    }
  },

  async checkStatus(
    accessToken: string,
    platformVideoId: string,
  ): Promise<{ status: PublishStatus; error?: string }> {
    const [_pageId, pageToken] = parseFacebookAccessToken(accessToken);

    const res = await fetch(
      `${FB_GRAPH_API}/${platformVideoId}?fields=status,permalink_url&access_token=${pageToken}`,
    );

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        recordFailure('facebook', FailureKind.AUTH_FAILURE);
      } else {
        recordFailure('facebook', classifyHttpStatus(res.status));
      }
      return { status: 'failed', error: `Facebook API ${res.status}` };
    }

    const data = await res.json() as { status?: { video_status?: string; processing_phase?: { status?: string } }; permalink_url?: string };

    if (data.status?.video_status === 'published' || data.status?.processing_phase?.status === 'finished') {
      recordSuccess('facebook');
      return { status: 'published' };
    }

    if (data.status?.video_status === 'failed' || data.status?.processing_phase?.status === 'failed') {
      recordFailure('facebook', FailureKind.SERVER_ERROR);
      return { status: 'failed', error: 'Video processing failed' };
    }

    return { status: 'processing' };
  },

  async refreshToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const res = await fetch(
      `${FB_TOKEN_URL}?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${refreshToken}`,
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Facebook token refresh failed: ${res.status} ${err}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  },
};
