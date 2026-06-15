/**
 * Pinterest Publisher Adapter
 * Uses Pinterest API v5 to upload video Pins to a board.
 * Falls back to mock 200 responses when PINTEREST_CLIENT_ID is absent.
 *
 * Upload flow:
 * 1. Register video upload → get upload_url + upload_id
 * 2. PUT video binary to upload_url
 * 3. POST /v5/pins with media_source.upload_id + optional media_product_tags
 * Returns pin_id.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

const PINTEREST_API = 'https://api.pinterest.com/v5';
// Pinterest video Pins: max 2GB / 30 min
const MAX_DESCRIPTION_LEN = 500;

function isMockMode(): boolean {
  return !process.env.PINTEREST_CLIENT_ID;
}

interface PinRegisterResponse {
  upload_id: string;
  upload_url: string;
  upload_parameters?: Record<string, string>;
}

interface PinCreateResponse {
  id: string;
}

interface PinStatsResponse {
  impression?: number;
  save?: number;
  outbound_click?: number;
  pin_click?: number;
}

export class PinterestPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    /** Target board ID — required for creating a Pin */
    private readonly boardId: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[PinterestPublisher] Mock mode — PINTEREST_CLIENT_ID missing');
      return `mock_pinterest_${Date.now()}`;
    }

    // Step 1: Fetch video binary
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`[PinterestPublisher] Failed to fetch video: ${videoRes.status}`);
    }
    const videoBlob = await videoRes.blob();
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

    // Step 2: Register video upload with Pinterest
    const registerRes = await fetch(`${PINTEREST_API}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ media_type: 'video' }),
    });

    if (!registerRes.ok) {
      const text = await registerRes.text();
      throw new Error(`[PinterestPublisher] Register upload failed (${registerRes.status}): ${text}`);
    }

    const registerData = (await registerRes.json()) as PinRegisterResponse;
    const { upload_id, upload_url } = registerData;

    // Step 3: Upload video binary to Pinterest's upload URL
    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: videoBlob,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`[PinterestPublisher] Video upload failed (${uploadRes.status}): ${text}`);
    }

    // Step 4: Build description (hashtags appended)
    const hashtags = meta.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    const description = `${meta.caption}\n\n${hashtags}`.slice(0, MAX_DESCRIPTION_LEN);

    // Step 5: Create the Pin
    const pinBody: Record<string, unknown> = {
      board_id: this.boardId,
      title: (meta.title ?? meta.caption).slice(0, 100),
      description,
      media_source: {
        source_type: 'video_id',
        upload_id,
      },
    };

    // Embed product tags if affiliate URL provided
    if (meta.productLink) {
      pinBody['media_product_tags'] = [
        {
          product_url: meta.productLink,
        },
      ];
      pinBody['link'] = meta.productLink;
    }

    const pinRes = await fetch(`${PINTEREST_API}/pins`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinBody),
    });

    if (!pinRes.ok) {
      const text = await pinRes.text();
      throw new Error(`[PinterestPublisher] Pin creation failed (${pinRes.status}): ${text}`);
    }

    const pin = (await pinRes.json()) as PinCreateResponse;
    return pin.id;
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

    // Pinterest Pins are synchronously published — check if pin exists
    const res = await fetch(`${PINTEREST_API}/pins/${encodeURIComponent(externalPostId)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (res.status === 404) return 'failed';
    if (!res.ok) return 'processing';
    return 'live';
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0 };
    }

    const res = await fetch(
      `${PINTEREST_API}/pins/${encodeURIComponent(externalPostId)}/analytics?start_date=${_today()}&end_date=${_today()}&metric_types=IMPRESSION,SAVE,OUTBOUND_CLICK,PIN_CLICK`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );

    if (!res.ok) return { views: 0, likes: 0 };

    const data = (await res.json()) as { all?: { daily_metrics?: PinStatsResponse[] } };
    const daily = data.all?.daily_metrics?.[0] ?? {};
    return {
      views: daily.impression ?? 0,
      likes: daily.pin_click ?? 0,
      shares: daily.save ?? 0,
      reach: daily.outbound_click ?? 0,
    };
  }
}

function _today(): string {
  return new Date().toISOString().slice(0, 10);
}
