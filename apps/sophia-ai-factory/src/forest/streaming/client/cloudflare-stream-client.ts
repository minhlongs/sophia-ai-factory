/**
 * @file cloudflare-stream-client.ts
 * @description Cloudflare Stream client orchestration class and singleton factory
 */

import type {
  CloudflareStreamVideoDetails,
  CloudflareStreamPlaybackUrls,
  CloudflareStreamClientConfig,
  CloudflareStreamApiResponse,
  ThumbnailOptions,
} from './types';
import { logger } from '@/seed/utils/logger-utility';
import { buildPlaybackUrls, buildThumbnailUrl } from './playback-resolver';
import { uploadFromUrlRequest, uploadDirectRequest } from './upload-manager';

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

  private assertCredentials(): void {
    if (!this.accountId || !this.apiToken) {
      throw new Error(
        'CLOUDFLARE_STREAM_CONFIG_MISSING: accountId and apiToken are required for Cloudflare Stream operations.'
      );
    }
  }

  getPlaybackUrls(streamUid: string): CloudflareStreamPlaybackUrls {
    return buildPlaybackUrls(streamUid, this.customerSubdomain);
  }

  getThumbnailUrl(streamUid: string, options?: ThumbnailOptions): string {
    return buildThumbnailUrl(streamUid, this.customerSubdomain, options);
  }

  async uploadFromUrl(
    url: string,
    meta?: Record<string, string>,
  ): Promise<CloudflareStreamVideoDetails> {
    this.assertCredentials();
    return uploadFromUrlRequest(this.baseUrl, this.apiToken, url, this.customerSubdomain, meta);
  }

  async uploadDirect(
    videoBytes: ArrayBuffer | Uint8Array,
    filename: string = 'video.mp4',
    meta?: Record<string, string>,
  ): Promise<CloudflareStreamVideoDetails> {
    this.assertCredentials();
    return uploadDirectRequest(this.baseUrl, this.apiToken, videoBytes, filename, this.customerSubdomain, meta);
  }

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

      const data = (await response.json()) as CloudflareStreamApiResponse;
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
        { streamUid },
      );
      throw err;
    }
  }

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
        { streamUid },
      );
      return false;
    }
  }
}

let streamClientInstance: CloudflareStreamClient | null = null;

export function getCloudflareStreamClient(
  config?: CloudflareStreamClientConfig,
): CloudflareStreamClient {
  if (!streamClientInstance || config) {
    streamClientInstance = new CloudflareStreamClient(config);
  }
  return streamClientInstance;
}
