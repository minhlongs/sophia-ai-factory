/**
 * Pinterest API client and upload workflows.
 */

import type { PublishMeta } from '../publisher-interface';
import { recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { PinRegisterResponse, PinCreateResponse } from './types';
import {
  PINTEREST_API,
  MAX_DESCRIPTION_LEN,
  isMockMode,
  todayIso,
  checkPinStatus,
  fetchPinMetrics,
} from './pinterest-telemetry';

export {
  PINTEREST_API,
  MAX_DESCRIPTION_LEN,
  isMockMode,
  todayIso,
  checkPinStatus,
  fetchPinMetrics,
};

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
