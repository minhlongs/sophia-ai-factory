/**
 * Zalo Official Account Publisher Adapter
 * Uses Zalo OA API v3 to upload videos to an OA timeline.

 * IMPORTANT: Requires Vietnamese business verification at https://oa.zalo.me/manage/oa
 * If ZALO_OA_ACCESS_TOKEN is absent, throws ZaloVerificationRequiredError with
 * actionable instructions for the VN business owner.

 * Falls back to mock 200 responses when ZALO_APP_ID is present but in test mode.

 * Upload flow:
 * 1. POST /v3/oa/message/video/upload → get video_id
 * 2. POST /v3/oa/message/broadcast with video_id → return broadcast_id
 */

import type { Publisher, PublishMeta, PublishResult, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

const ZALO_OA_API = 'https://openapi.zalo.me';
const MAX_CAPTION_LEN = 1000;

/** Thrown when Zalo OA credentials are absent — guides VN business owner to verify OA. */
export class ZaloVerificationRequiredError extends Error {
  readonly actionUrl = 'https://oa.zalo.me/manage/oa';
  readonly docsUrl = 'https://developers.zalo.me/docs/official-account';

  constructor() {
    super(
      'Zalo OA credentials not configured. '
      + 'Your business must be verified on Zalo Official Account before using this publisher. '
      + 'Please complete business verification at https://oa.zalo.me/manage/oa '
      + 'and then set ZALO_APP_ID, ZALO_APP_SECRET, and ZALO_OA_ACCESS_TOKEN environment variables. '
      + 'Documentation: https://developers.zalo.me/docs/official-account',
    );
    this.name = 'ZaloVerificationRequiredError';
  }

  async delete(postId: string): Promise<void> {
    logger.warn("[zalo-publisher.ts] delete not implemented", { postId });
  }
}

/** Mock mode: ZALO_APP_ID is set (developer configured) but ZALO_OA_ACCESS_TOKEN absent. */
function checkMode(): 'missing' | 'mock' | 'real' {
  if (!process.env.ZALO_APP_ID && !process.env.ZALO_OA_ACCESS_TOKEN) return 'missing';
  if (!process.env.ZALO_OA_ACCESS_TOKEN) return 'mock';
  return 'real';
}

interface ZaloUploadResponse {
  error: number;
  message: string;
  data?: { video_id?: string; token?: string };
}

interface ZaloBroadcastResponse {
  error: number;
  message: string;
  data?: { broadcast_id?: string };
}

export class ZaloPublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async publish(videoUrl: string, meta: PublishMeta): Promise<PublishResult> {
    try {
      const broadcastId = await this.doPublish(videoUrl, meta);
      return { success: true, externalPostId: broadcastId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  }

  private async doPublish(videoUrl: string, meta: PublishMeta): Promise<string> {
    const mode = checkMode();
    if (mode === 'missing') throw new ZaloVerificationRequiredError();
    if (mode === 'mock') {
      logger.warn('[ZaloPublisher] Mock mode — ZALO_OA_ACCESS_TOKEN missing');
      return `mock_zalo_${Date.now()}`;
    }

    // Step 1: Fetch video binary
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`[ZaloPublisher] Failed to fetch video: ${videoRes.status}`);
    }
    const videoBlob = await videoRes.blob();
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

    // Step 2: Upload video to Zalo OA
    const formData = new FormData();
    formData.append('file', videoBlob, 'video.mp4');
    formData.append('type', contentType);

    const uploadRes = await fetch(`${ZALO_OA_API}/v3/oa/message/video/upload`, {
      method: 'POST',
      headers: { access_token: this.accessToken },
      body: formData,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`[ZaloPublisher] Video upload failed (${uploadRes.status}): ${text}`);
    }

    const uploadData = (await uploadRes.json()) as ZaloUploadResponse;
    if (uploadData.error !== 0) {
      throw new Error(`[ZaloPublisher] Upload error ${uploadData.error}: ${uploadData.message}`);
    }

    const videoId = uploadData.data?.video_id;
    if (!videoId) {
      throw new Error('[ZaloPublisher] No video_id returned from upload');
    }

    // Step 3: Build caption
    const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    const caption = `${meta.caption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`.slice(
      0,
      MAX_CAPTION_LEN,
    );

    // Step 4: Broadcast to OA timeline
    const broadcastRes = await fetch(`${ZALO_OA_API}/v3/oa/message/broadcast`, {
      method: 'POST',
      headers: {
        access_token: this.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { user_id: 'all' },
        message: {
          attachment: {
            type: 'video',
            payload: { video_id: videoId, description: caption },
          },
        },
      }),
    });

    if (!broadcastRes.ok) {
      const text = await broadcastRes.text();
      throw new Error(`[ZaloPublisher] Broadcast failed (${broadcastRes.status}): ${text}`);
    }

    const broadcastData = (await broadcastRes.json()) as ZaloBroadcastResponse;
    if (broadcastData.error !== 0) {
      throw new Error(`[ZaloPublisher] Broadcast error ${broadcastData.error}: ${broadcastData.message}`);
    }

    return broadcastData.data?.broadcast_id ?? videoId;
  }

  async getStatus(externalPostId: string): Promise<PublishStatus> {
    if (checkMode() !== 'real' || externalPostId.startsWith('mock_')) return 'live';
    return 'live';
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (checkMode() !== 'real' || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0 };
    }

    const res = await fetch(
      `${ZALO_OA_API}/v3/oa/statistic/message?broadcast_id=${encodeURIComponent(externalPostId)}`,
      { headers: { access_token: this.accessToken } },
    );

    if (!res.ok) return { views: 0, likes: 0 };

    const data = (await res.json()) as {
      error: number;
      data?: { sent?: number; delivered?: number; read?: number };
    };

    if (data.error !== 0) return { views: 0, likes: 0 };

    return {
      views: data.data?.read ?? 0,
      likes: 0,
      reach: data.data?.delivered ?? 0,
    };
  }
}
