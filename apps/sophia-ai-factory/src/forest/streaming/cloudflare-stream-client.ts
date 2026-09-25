/**
 * Cloudflare Stream Client
 *
 * Provides API client capabilities for Cloudflare Stream:
 * - Direct video upload (binary / multipart)
 * - Upload via URL copy (asynchronous ingestion)
 * - Adaptive bitrate stream retrieval (HLS .m3u8 & DASH .mpd)
 * - Dynamic animated preview and thumbnail capture
 *
 * Layer: forest/streaming (External edge streaming gateway)
 * Dependencies: seed/types/streaming, seed/utils/logger-utility (0 land imports)
 *
 * @module forest/streaming/cloudflare-stream-client
 */

import type {
  CloudflareStreamVideoDetails,
  CloudflareStreamPlaybackUrls,
} from '@/seed/types/streaming';
import { logger } from '@/seed/utils/logger-utility';

export interface CloudflareStreamClientConfig {
  accountId?: string;
  apiToken?: string;
  customerSubdomain?: string;
}

export class CloudflareStreamClient {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly customerSubdomain: string;
  private readonly baseUrl: string;

  constructor(config: CloudflareStreamClientConfig = {}) {
    this.accountId =
      config.accountId ||
      (typeof process !== 'undefined'
        ? process.env.CLOUDFLARE_STREAM_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || ''
        : '');

    this.apiToken =
      config.apiToken ||
      (typeof process !== 'undefined'
        ? process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''
        : '');

    this.customerSubdomain =
      config.customerSubdomain ||
      (typeof process !== 'undefined'
        ? process.env.CLOUDFLARE_STREAM_SUBDOMAIN || ''
        : '');

    this.baseUrl = this.accountId
      ? `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`
      : '';
  }

  /**
   * Asserts that client credentials are present.
   */
  private assertCredentials(): void {
    if (!this.accountId || !this.apiToken) {
      throw new Error(
        'CLOUDFLARE_STREAM_CONFIG_MISSING: accountId and apiToken are required for Cloudflare Stream operations.'
      );
    }
  }

  /**
   * Generates public playback URLs for an uploaded Cloudflare Stream video UID.
   */
  getPlaybackUrls(streamUid: string): CloudflareStreamPlaybackUrls {
    if (!streamUid) {
      throw new Error('INVALID_STREAM_UID: streamUid is required');
    }

    const host = this.customerSubdomain
      ? `customer-${this.customerSubdomain}.cloudflarestream.com`
      : 'videodelivery.net';

    return {
      hls: `https://${host}/${streamUid}/manifest/video.m3u8`,
      dash: `https://${host}/${streamUid}/manifest/video.mpd`,
      preview: `https://${host}/${streamUid}/watch`,
      thumbnail: `https://${host}/${streamUid}/thumbnails/thumbnail.jpg?time=1s`,
    };
  }

  /**
   * Generates a thumbnail URL at an exact timestamp with custom dimensions.
   */
  getThumbnailUrl(
    streamUid: string,
    options?: { timeSec?: number; width?: number; height?: number }
  ): string {
    if (!streamUid) {
      throw new Error('INVALID_STREAM_UID: streamUid is required');
    }

    const host = this.customerSubdomain
      ? `customer-${this.customerSubdomain}.cloudflarestream.com`
      : 'videodelivery.net';

    const params = new URLSearchParams();
    if (options?.timeSec !== undefined) {
      params.set('time', `${options.timeSec}s`);
    } else {
      params.set('time', '1s');
    }

    if (options?.width) {
      params.set('width', String(options.width));
    }
    if (options?.height) {
      params.set('height', String(options.height));
    }

    return `https://${host}/${streamUid}/thumbnails/thumbnail.jpg?${params.toString()}`;
  }

  /**
   * Initiates an asynchronous copy upload from a public video URL.
   */
  async uploadFromUrl(
    url: string,
    meta?: Record<string, string>
  ): Promise<CloudflareStreamVideoDetails> {
    this.assertCredentials();

    if (!url || typeof url !== 'string') {
      throw new Error('INVALID_URL: Source video URL is required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/copy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
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

      const data = (await response.json()) as {
        success: boolean;
        result: {
          uid: string;
          readyToStream: boolean;
          status?: { state: 'inprogress' | 'ready' | 'error' | 'downloading' | 'queued' };
          meta?: Record<string, string>;
          duration?: number;
          thumbnail?: string;
        };
      };

      const result = data.result;
      const playback = this.getPlaybackUrls(result.uid);

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
        { url }
      );
      throw err;
    }
  }

  /**
   * Uploads raw video bytes directly to Cloudflare Stream.
   */
  async uploadDirect(
    videoBytes: ArrayBuffer | Uint8Array,
    filename: string = 'video.mp4',
    meta?: Record<string, string>
  ): Promise<CloudflareStreamVideoDetails> {
    this.assertCredentials();

    try {
      const formData = new FormData();
      const blob = new Blob([videoBytes as BlobPart], { type: 'video/mp4' });
      formData.append('file', blob, filename);

      if (meta) {
        formData.append('meta', JSON.stringify(meta));
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
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

      const data = (await response.json()) as {
        success: boolean;
        result: {
          uid: string;
          readyToStream: boolean;
          status?: { state: 'inprogress' | 'ready' | 'error' | 'downloading' | 'queued' };
          meta?: Record<string, string>;
          duration?: number;
          thumbnail?: string;
        };
      };

      const result = data.result;
      const playback = this.getPlaybackUrls(result.uid);

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
        { filename }
      );
      throw err;
    }
  }

  /**
   * Retrieves encoding and streaming status for a video UID.
   */
  async getVideoDetails(streamUid: string): Promise<CloudflareStreamVideoDetails> {
    this.assertCredentials();

    if (!streamUid) {
      throw new Error('INVALID_STREAM_UID: streamUid is required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(streamUid)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[CloudflareStreamClient] getVideoDetails failed', undefined, {
          streamUid,
          status: response.status,
        });
        throw new Error(`Cloudflare Stream getVideoDetails failed (HTTP ${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        success: boolean;
        result: {
          uid: string;
          readyToStream: boolean;
          status?: {
            state: 'inprogress' | 'ready' | 'error' | 'downloading' | 'queued';
            pctComplete?: string;
            errorReasonCode?: string;
            errorReasonText?: string;
          };
          meta?: Record<string, string>;
          duration?: number;
          maxDurationSeconds?: number;
          thumbnail?: string;
          created?: string;
          modified?: string;
        };
      };

      const result = data.result;
      const playback = this.getPlaybackUrls(result.uid);

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
        { streamUid }
      );
      throw err;
    }
  }

  /**
   * Deletes a video from Cloudflare Stream.
   */
  async deleteVideo(streamUid: string): Promise<boolean> {
    this.assertCredentials();

    if (!streamUid) {
      throw new Error('INVALID_STREAM_UID: streamUid is required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(streamUid)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      return response.ok;
    } catch (err) {
      logger.error(
        '[CloudflareStreamClient] Error in deleteVideo',
        err instanceof Error ? err : undefined,
        { streamUid }
      );
      return false;
    }
  }
}

/**
 * Singleton factory for Cloudflare Stream Client.
 */
let streamClientInstance: CloudflareStreamClient | null = null;

export function getCloudflareStreamClient(
  config?: CloudflareStreamClientConfig
): CloudflareStreamClient {
  if (!streamClientInstance || config) {
    streamClientInstance = new CloudflareStreamClient(config);
  }
  return streamClientInstance;
}
