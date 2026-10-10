/**
 * @file playback-resolver.ts
 * @description Cloudflare Stream HLS/DASH manifest and thumbnail URL generator
 */

import type { CloudflareStreamPlaybackUrls, ThumbnailOptions } from './types';

export function buildPlaybackUrls(
  streamUid: string,
  customerSubdomain?: string,
): CloudflareStreamPlaybackUrls {
  if (!streamUid) {
    throw new Error('INVALID_STREAM_UID: streamUid is required');
  }

  const host = customerSubdomain
    ? `customer-${customerSubdomain}.cloudflarestream.com`
    : 'videodelivery.net';

  return {
    hls: `https://${host}/${streamUid}/manifest/video.m3u8`,
    dash: `https://${host}/${streamUid}/manifest/video.mpd`,
    preview: `https://${host}/${streamUid}/watch`,
    thumbnail: `https://${host}/${streamUid}/thumbnails/thumbnail.jpg?time=1s`,
  };
}

export function buildThumbnailUrl(
  streamUid: string,
  customerSubdomain?: string,
  options?: ThumbnailOptions,
): string {
  if (!streamUid) {
    throw new Error('INVALID_STREAM_UID: streamUid is required');
  }

  const host = customerSubdomain
    ? `customer-${customerSubdomain}.cloudflarestream.com`
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
