/**
 * Threads Publisher Adapter — Meta Graph API via graph.threads.net.
 * Two-step publish: create media container → publish container.
 * Supports video (VIDEO type) and link posts (TEXT type with link).
 * Falls back to mock responses when THREADS_APP_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

const THREADS_BASE = 'https://graph.threads.net/v1.0';

function isMockMode(): boolean {
  return !process.env.THREADS_APP_ID;
}

interface ThreadsCreateResponse { id?: string; error?: { message?: string } }
interface ThreadsInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>
}

function buildCaption(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ? `\n\n${meta.productLink}` : '';
  return `${adCaption}${tags ? ` ${tags}` : ''}${link}`.slice(0, 500);
}

export class ThreadsPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    private readonly userId: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[ThreadsPublisher] Mock mode — THREADS_APP_ID missing');
      return `mock_threads_${Date.now()}`;
    }

    const text = buildCaption(meta);

    // Step 1: Create media container
    const containerRes = await fetch(`${THREADS_BASE}/${this.userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'VIDEO',
        video_url: videoUrl,
        text,
        access_token: this.accessToken,
      }),
    });
    if (!containerRes.ok) {
      const body = await containerRes.text().catch(() => '');
      throw new Error(`Threads container creation failed (${containerRes.status}): ${body.slice(0, 300)}`);
    }
    const containerData = (await containerRes.json()) as ThreadsCreateResponse;
    if (!containerData.id) {
      throw new Error(`Threads container returned no id: ${containerData.error?.message ?? 'unknown'}`);
    }

    // Step 2: Publish container
    const publishRes = await fetch(`${THREADS_BASE}/${this.userId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: this.accessToken,
      }),
    });
    if (!publishRes.ok) {
      const body = await publishRes.text().catch(() => '');
      throw new Error(`Threads publish failed (${publishRes.status}): ${body.slice(0, 300)}`);
    }
    const publishData = (await publishRes.json()) as ThreadsCreateResponse;
    if (!publishData.id) {
      throw new Error(`Threads publish returned no post id: ${publishData.error?.message ?? 'unknown'}`);
    }
    return publishData.id;
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';
    // Threads publishes synchronously — if post exists it's live
    const res = await fetch(
      `${THREADS_BASE}/${externalPostId}?fields=id,status&access_token=${this.accessToken}`,
    );
    if (res.status === 404) return 'failed';
    if (res.ok) return 'live';
    return 'processing';
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0 };
    }
    const metrics = 'views,likes,replies';
    const res = await fetch(
      `${THREADS_BASE}/${externalPostId}/insights?metric=${metrics}&access_token=${this.accessToken}`,
    );
    if (!res.ok) return { views: 0, likes: 0, comments: 0 };
    const data = (await res.json()) as ThreadsInsightsResponse;
    const findNum = (name: string): number => {
      const v = data.data?.find(m => m.name === name)?.values?.[0]?.value;
      return typeof v === 'number' ? v : 0;
    };
    return {
      views: findNum('views'),
      likes: findNum('likes'),
      comments: findNum('replies'),
    };
  }
}
