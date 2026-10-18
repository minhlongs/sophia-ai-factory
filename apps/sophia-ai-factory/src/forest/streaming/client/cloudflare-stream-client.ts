/**
 * @file cloudflare-stream-client.ts
 * @description Cloudflare Stream client orchestration class and singleton factory
 */

import type {
  CloudflareStreamVideoDetails,
  CloudflareStreamPlaybackUrls,
  CloudflareStreamClientConfig,
  ThumbnailOptions,
} from './types';
import { buildPlaybackUrls, buildThumbnailUrl } from './playback-resolver';
import { uploadFromUrlRequest, uploadDirectRequest } from './upload-manager';
import { fetchVideoDetailsRequest, deleteVideoRequest } from './video-operations';

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
        'CLOUDFLARE_STREAM_CONFIG_MISSING: accountId and apiToken are required for Cloudflare Stream operations.',
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
    return uploadDirectRequest(
      this.baseUrl,
      this.apiToken,
      videoBytes,
      filename,
      this.customerSubdomain,
      meta,
    );
  }

  async getVideoDetails(streamUid: string): Promise<CloudflareStreamVideoDetails> {
    this.assertCredentials();
    return fetchVideoDetailsRequest(
      this.baseUrl,
      this.apiToken,
      streamUid,
      (uid) => this.getPlaybackUrls(uid),
    );
  }

  async deleteVideo(streamUid: string): Promise<boolean> {
    this.assertCredentials();
    return deleteVideoRequest(this.baseUrl, this.apiToken, streamUid);
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
