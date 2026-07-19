/**
 * X/Twitter Publisher Adapter — chunked /2/media/upload + tweet creation.
 * Constraints: video ≤ 512MB, ≤ 140s; tweet text ≤ 280 chars (Free/Basic).
 * Falls back to mock 200 responses when TWITTER_CLIENT_ID is absent.
 */

import type { Publisher, PublishMeta, PublishResult, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

const X_API = 'https://api.x.com';
const MEDIA_UPLOAD = `${X_API}/2/media/upload`;
const TWEETS = `${X_API}/2/tweets`;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT = 280;

function isMockMode(): boolean {
  return !process.env.TWITTER_CLIENT_ID;
}

interface MediaInitResponse {
  data?: { id: string };
  processing_info?: { state: string };
}

interface TweetCreateResponse {
  data?: { id: string };
  errors?: Array<{ message?: string }>;
}

interface TweetMetricsResponse {
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

function buildTweetText(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ? ` ${meta.productLink}` : '';
  const full = `${adCaption}${tags ? ` ${tags}` : ''}${link}`.trim();
  return full.length > MAX_TEXT ? full.slice(0, MAX_TEXT - 1) + '…' : full;
}

export class TwitterPublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async publish(videoUrl: string, meta: PublishMeta): Promise<PublishResult> {
    try {
      const tweetId = await this.doPublish(videoUrl, meta);
      return { success: true, externalPostId: tweetId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  }

  private async doPublish(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[TwitterPublisher] Mock mode — TWITTER_CLIENT_ID missing');
      return `mock_twitter_${Date.now()}`;
    }

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`X video fetch failed: HTTP ${videoRes.status}`);
    const buffer = await videoRes.arrayBuffer();
    const totalBytes = buffer.byteLength;

    const initRes = await fetch(MEDIA_UPLOAD, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
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
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: form,
      });

      if (!appendRes.ok) throw new Error(`X media APPEND chunk ${i} failed: HTTP ${appendRes.status}`);
    }

    const finalRes = await fetch(MEDIA_UPLOAD, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }),
    });

    if (!finalRes.ok) throw new Error(`X media FINALIZE failed: HTTP ${finalRes.status}`);

    const tweetRes = await fetch(TWEETS, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: buildTweetText(meta),
        media: { media_ids: [mediaId] },
      }),
    });

    if (!tweetRes.ok) {
      const body = await tweetRes.text().catch((err) => {
        logger.warn('Failed to read X tweet response', { error: String(err), context: 'TwitterPublisher.publish' });
        return '';
      });
      throw new Error(`X /2/tweets failed: HTTP ${tweetRes.status} — ${body.slice(0, 200)}`);
    }

    const tweetData = (await tweetRes.json()) as TweetCreateResponse;
    const tweetId = tweetData.data?.id;
    if (!tweetId) throw new Error('X tweet create returned no id');
    return tweetId;
  }

  async getStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

    const res = await fetch(`${X_API}/2/tweets/${externalPostId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (res.status === 404) return 'failed';
    if (res.ok) return 'live';
    return 'processing';
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }

    const res = await fetch(
      `${X_API}/2/tweets/${externalPostId}?tweet.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );

    if (!res.ok) return { views: 0, likes: 0, comments: 0, shares: 0 };

    const data = (await res.json()) as TweetMetricsResponse;
    const m = data.data?.public_metrics ?? {};
    return {
      views: m.impression_count ?? 0,
      likes: m.like_count ?? 0,
      comments: m.reply_count ?? 0,
      shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
    };
  }

  async delete(postId: string): Promise<void> {
    logger.warn("[twitter-publisher.ts] delete not implemented", { postId });
  }
}
