import type { PlatformAdapter, PublishParams, PublishResult, PublishStatus } from '@/tree/publishing/platform-adapter';
import { logger } from '@/seed/utils/logger-utility';

const TT_API = 'https://open.tiktokapis.com/v2';
const TT_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

export const tiktokAdapter: PlatformAdapter = {
  platform: 'tiktok',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
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

    const initData = await initRes.json() as {
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
  },

  async checkStatus(
    accessToken: string,
    platformVideoId: string,
  ): Promise<{ status: PublishStatus; error?: string }> {
    const res = await fetch(`${TT_API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publish_id: platformVideoId }),
    });

    if (!res.ok) return { status: 'failed', error: `TikTok API ${res.status}` };

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
  },

  async refreshToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
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
      throw new Error(`TikTok token refresh failed: ${res.status} ${err}`);
    }

    const data = await res.json() as {
      data: { access_token: string; expires_in: number };
    };
    return { accessToken: data.data.access_token, expiresIn: data.data.expires_in };
  },
};
