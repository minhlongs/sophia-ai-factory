import type {
  CloudflareStreamVideoDetails,
  CloudflareStreamPlaybackUrls,
  CloudflareStreamApiResponse,
} from './types';
import { logger } from '@/seed/utils/logger-utility';

export async function fetchVideoDetailsRequest(
  baseUrl: string,
  apiToken: string,
  streamUid: string,
  resolvePlayback: (uid: string) => CloudflareStreamPlaybackUrls,
): Promise<CloudflareStreamVideoDetails> {
  if (!streamUid) {
    throw new Error('INVALID_STREAM_UID: streamUid is required');
  }

  try {
    const response = await fetch(`${baseUrl}/${encodeURIComponent(streamUid)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[CloudflareStreamClient] getVideoDetails failed', undefined, {
        streamUid,
        status: response.status,
      });
      throw new Error(
        `Cloudflare Stream getVideoDetails failed (HTTP ${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as CloudflareStreamApiResponse;
    const result = data.result;
    const playback = resolvePlayback(result.uid);

    return {
      uid: result.uid,
      readyToStream: result.readyToStream,
      status: result.status,
      meta: result.meta,
      duration: result.duration,
      maxDurationSeconds: result.maxDurationSeconds,
      thumbnail: result.thumbnail ?? playback.thumbnail,
      created: result.created,
      modified: result.modified,
      playback,
    };
  } catch (err) {
    logger.error(
      '[CloudflareStreamClient] Error in getVideoDetails',
      err instanceof Error ? err : undefined,
      { streamUid },
    );
    throw err;
  }
}

export async function deleteVideoRequest(
  baseUrl: string,
  apiToken: string,
  streamUid: string,
): Promise<boolean> {
  if (!streamUid) {
    throw new Error('INVALID_STREAM_UID: streamUid is required');
  }

  try {
    const response = await fetch(`${baseUrl}/${encodeURIComponent(streamUid)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    return response.ok;
  } catch (err) {
    logger.error(
      '[CloudflareStreamClient] Error in deleteVideo',
      err instanceof Error ? err : undefined,
      { streamUid },
    );
    return false;
  }
}
