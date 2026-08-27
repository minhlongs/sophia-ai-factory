import { shouldAllowRequest, recordFailure, recordSuccess } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';
import type { PlatformAdapter, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';

const FB_GRAPH_API = 'https://graph.facebook.com/v19.0';
const FB_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';

export const facebookAdapter: PlatformAdapter = {
  platform: 'facebook',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
    if (!shouldAllowRequest('facebook')) {
      throw new Error('[facebook-adapter] Circuit breaker open for facebook');
    }
    try {
      // Facebook Reels/Video: two-step upload (start upload -> finish upload)
      // accessToken format: "pageId:pageAccessToken"
      const [pageId, pageToken] = accessToken.includes(':')
        ? accessToken.split(':', 2)
        : ['me', accessToken];

      // Step 1: Start upload session
      const startRes = await fetch(`${FB_GRAPH_API}/${pageId}/video_reels`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pageToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_phase: 'start',
          video_file_url: params.videoUrl,
        }),
      });

      if (!startRes.ok) {
        const err = await startRes.text();
        throw new Error(`Facebook upload start failed: ${startRes.status} ${err}`);
      }

      const startData = await startRes.json() as { video_id?: string; upload_url?: string };
      const videoId = startData.video_id;
      const uploadUrl = startData.upload_url;

      if (!videoId || !uploadUrl) {
        throw new Error('Facebook did not return video_id or upload_url');
      }

      // Step 2: Upload video bytes to the provided URL
      const videoRes = await fetch(params.videoUrl);
      if (!videoRes.ok) throw new Error(`Failed to fetch video from ${params.videoUrl}`);
      const videoBuffer = await videoRes.arrayBuffer();

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pageToken}`,
          'Content-Type': 'video/mp4',
          'Content-Length': String(videoBuffer.byteLength),
        },
        body: videoBuffer,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`Facebook upload failed: ${uploadRes.status} ${err}`);
      }

      // Step 3: Finish upload and publish
      const finishRes = await fetch(`${FB_GRAPH_API}/${pageId}/video_reels`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pageToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_phase: 'finish',
          video_id: videoId,
          title: params.title,
          description: params.description,
        }),
      });

      if (!finishRes.ok) {
        const err = await finishRes.text();
        throw new Error(`Facebook finish upload failed: ${finishRes.status} ${err}`);
      }

      const finishData = await finishRes.json() as { id?: string; status?: string };
      const platformVideoId = finishData.id ?? videoId;

      logger.info('[facebook-adapter] Upload complete', {
        platformVideoId,
        status: finishData.status,
      });

      return {
        platformVideoId,
        status: 'processing',
        url: `https://www.facebook.com/${pageId}/videos/${platformVideoId}`,
      };
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
    const [pageId, pageToken] = accessToken.includes(':')
      ? accessToken.split(':', 2)
      : ['me', accessToken];

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
    // Facebook long-lived page token exchange
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