/**
 * @file upload-manager.ts
 * @description Direct upload and URL copy upload operations for Cloudflare Stream
 */

import { logger } from '@/seed/utils/logger-utility';
import type { CloudflareStreamVideoDetails, CloudflareStreamApiResponse } from './types';
import { buildPlaybackUrls } from './playback-resolver';

export async function uploadFromUrlRequest(
  baseUrl: string,
  apiToken: string,
  url: string,
  customerSubdomain?: string,
  meta?: Record<string, string>,
): Promise<CloudflareStreamVideoDetails> {
  if (!url || typeof url !== 'string') {
    throw new Error('INVALID_URL: Source video URL is required');
  }

  try {
    const response = await fetch(`${baseUrl}/copy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        meta: meta ?? {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[CloudflareStreamClient] uploadFromUrl failed', undefined, {
        status: response.status,
        errorText,
      });
      throw new Error(`Cloudflare Stream copy failed (HTTP ${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as CloudflareStreamApiResponse;
    const result = data.result;
    const playback = buildPlaybackUrls(result.uid, customerSubdomain);

    return {
      uid: result.uid,
      readyToStream: result.readyToStream,
      status: result.status,
      meta: result.meta,
      duration: result.duration,
      thumbnail: result.thumbnail ?? playback.thumbnail,
      playback,
    };
  } catch (err) {
    logger.error(
      '[CloudflareStreamClient] Error in uploadFromUrl',
      err instanceof Error ? err : undefined,
      { url },
    );
    throw err;
  }
}

export async function uploadDirectRequest(
  baseUrl: string,
  apiToken: string,
  videoBytes: ArrayBuffer | Uint8Array,
  filename: string = 'video.mp4',
  customerSubdomain?: string,
  meta?: Record<string, string>,
): Promise<CloudflareStreamVideoDetails> {
  try {
    const formData = new FormData();
    const blob = new Blob([videoBytes as BlobPart], { type: 'video/mp4' });
    formData.append('file', blob, filename);

    if (meta) {
      formData.append('meta', JSON.stringify(meta));
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[CloudflareStreamClient] uploadDirect failed', undefined, {
        status: response.status,
        errorText,
      });
      throw new Error(`Cloudflare Stream direct upload failed (HTTP ${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as CloudflareStreamApiResponse;
    const result = data.result;
    const playback = buildPlaybackUrls(result.uid, customerSubdomain);

    return {
      uid: result.uid,
      readyToStream: result.readyToStream,
      status: result.status,
      meta: result.meta,
      duration: result.duration,
      thumbnail: result.thumbnail ?? playback.thumbnail,
      playback,
    };
  } catch (err) {
    logger.error(
      '[CloudflareStreamClient] Error in uploadDirect',
      err instanceof Error ? err : undefined,
      { filename },
    );
    throw err;
  }
}
