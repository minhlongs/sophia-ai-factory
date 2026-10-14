/**
 * Pinterest API client and upload workflows.
 */

import type { PublishMeta, PublishStatus, MetricsJson } from '../publisher-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { PinRegisterResponse, PinCreateResponse, PinStatsResponse } from './types';

export const PINTEREST_API = 'https://api.pinterest.com/v5';
export const MAX_DESCRIPTION_LEN = 500;

export function isMockMode(): boolean {
  return !process.env.PINTEREST_CLIENT_ID;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function uploadVideoPin(
  accessToken: string,
  boardId: string,
  videoUrl: string,
  meta: PublishMeta
): Promise<string> {
  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`[PinterestPublisher] Failed to fetch video: ${videoRes.status}`);
    }
    const videoBlob = await videoRes.blob();
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

    const registerRes = await fetch(`${PINTEREST_API}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ media_type: 'video' }),
    });

    if (!registerRes.ok) {
      const text = await registerRes.text();
      throw new Error(`[PinterestPublisher] Register upload failed (${registerRes.status}): ${text}`);
    }

    const { upload_id, upload_url } = (await registerRes.json()) as PinRegisterResponse;

    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: videoBlob,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`[PinterestPublisher] Video upload failed (${uploadRes.status}): ${text}`);
    }

    const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    const description = `${meta.caption}\n\n${hashtags}`.slice(0, MAX_DESCRIPTION_LEN);

    const pinBody: Record<string, unknown> = {
      board_id: boardId,
      title: (meta.title ?? meta.caption).slice(0, 100),
      description,
      media_source: {
        source_type: 'video_id',
        upload_id,
      },
    };

    if (meta.productLink) {
      pinBody['media_product_tags'] = [{ product_url: meta.productLink }];
      pinBody['link'] = meta.productLink;
    }

    const pinRes = await fetch(`${PINTEREST_API}/pins`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinBody),
    });

    if (!pinRes.ok) {
      const text = await pinRes.text();
      throw new Error(`[PinterestPublisher] Pin creation failed (${pinRes.status}): ${text}`);
    }

    const pin = (await pinRes.json()) as PinCreateResponse;
    recordSuccess('pinterest');
    return pin.id;
  } catch (error) {
    recordFailure('pinterest', classifyError(error));
    throw error;
  }
}

export async function checkPinStatus(accessToken: string, externalPostId: string): Promise<PublishStatus> {
  if (!shouldAllowRequest('pinterest')) return 'processing';

  try {
    const res = await fetch(`${PINTEREST_API}/pins/${encodeURIComponent(externalPostId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 404) return 'failed';
    if (!res.ok) return 'processing';
    recordSuccess('pinterest');
    return 'live';
  } catch (error) {
    recordFailure('pinterest', classifyError(error));
    return 'processing';
  }
}

export async function fetchPinMetrics(accessToken: string, externalPostId: string): Promise<MetricsJson> {
  if (!shouldAllowRequest('pinterest')) {
    return { views: 0, likes: 0 };
  }

  try {
    const today = todayIso();
    const res = await fetch(
      `${PINTEREST_API}/pins/${encodeURIComponent(externalPostId)}/analytics?start_date=${today}&end_date=${today}&metric_types=IMPRESSION,SAVE,OUTBOUND_CLICK,PIN_CLICK`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) return { views: 0, likes: 0 };

    const data = (await res.json()) as { all?: { daily_metrics?: PinStatsResponse[] } };
    const daily = data.all?.daily_metrics?.[0] ?? {};
    recordSuccess('pinterest');
    return {
      views: daily.impression ?? 0,
      likes: daily.pin_click ?? 0,
      shares: daily.save ?? 0,
      reach: daily.outbound_click ?? 0,
    };
  } catch (error) {
    recordFailure('pinterest', classifyError(error));
    return { views: 0, likes: 0 };
  }
}
