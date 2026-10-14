/**
 * Chunked media upload and text formatting helpers for X/Twitter Publisher.
 * @module land/video/publishing/providers/twitter-media-helpers
 */

import type { PublishMeta } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

export const X_API = 'https://api.x.com';
export const MEDIA_UPLOAD = `${X_API}/2/media/upload`;
export const TWEETS = `${X_API}/2/tweets`;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT = 280;

export interface MediaInitResponse {
  data?: { id: string };
  processing_info?: { state: string };
}
export interface TweetCreateResponse {
  data?: { id: string };
  errors?: Array<{ message?: string }>;
}
export interface TweetMetricsResponse {
  data?: {
    public_metrics?: {
      retweet_count?: number;
      reply_count?: number;
      like_count?: number;
      quote_count?: number;
      impression_count?: number;
    };
  };
}

export function buildTweetText(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ? ` ${meta.productLink}` : '';
  const full = `${adCaption}${tags ? ` ${tags}` : ''}${link}`.trim();
  return full.length > MAX_TEXT ? full.slice(0, MAX_TEXT - 1) + '…' : full;
}

export async function uploadChunkedTwitterMedia(
  videoUrl: string,
  accessToken: string,
): Promise<string> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`X video fetch failed: HTTP ${videoRes.status}`);
  const buffer = await videoRes.arrayBuffer();
  const totalBytes = buffer.byteLength;

  const initRes = await fetch(MEDIA_UPLOAD, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'INIT',
      media_type: 'video/mp4',
      media_category: 'tweet_video',
      total_bytes: String(totalBytes),
    }),
  });
  if (!initRes.ok) throw new Error(`X media INIT failed: HTTP ${initRes.status}`);
  const initData = (await initRes.json()) as MediaInitResponse;
  const mediaId = initData.data?.id;
  if (!mediaId) throw new Error('X media INIT returned no media_id');

  const chunks = Math.ceil(totalBytes / CHUNK_SIZE);
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunk = buffer.slice(start, end);
    const form = new FormData();
    form.append('command', 'APPEND');
    form.append('media_id', mediaId);
    form.append('segment_index', String(i));
    form.append('media', new Blob([chunk]), 'chunk');
    const appendRes = await fetch(MEDIA_UPLOAD, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!appendRes.ok) throw new Error(`X media APPEND chunk ${i} failed: HTTP ${appendRes.status}`);
  }

  const finalRes = await fetch(MEDIA_UPLOAD, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }),
  });
  if (!finalRes.ok) throw new Error(`X media FINALIZE failed: HTTP ${finalRes.status}`);

  return mediaId;
}

export async function createTweetWithMedia(
  accessToken: string,
  meta: PublishMeta,
  mediaId: string,
): Promise<string> {
  const tweetRes = await fetch(TWEETS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: buildTweetText(meta), media: { media_ids: [mediaId] } }),
  });
  if (!tweetRes.ok) {
    const body = await tweetRes.text().catch((err) => {
      logger.warn('Failed to read X tweet response', { error: String(err), context: 'TwitterPublisher.upload' });
      return '';
    });
    throw new Error(`X /2/tweets failed: HTTP ${tweetRes.status} — ${body.slice(0, 200)}`);
  }
  const tweetData = (await tweetRes.json()) as TweetCreateResponse;
  const tweetId = tweetData.data?.id;
  if (!tweetId) throw new Error('X tweet create returned no id');
  return tweetId;
}
