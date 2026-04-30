/**
 * Instagram Publisher Adapter
 * Uses Instagram Graph API (Business accounts only).
 * Falls back to mock 200 responses when INSTAGRAM_APP_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/lib/utils/logger-utility';

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
function isMockMode(): boolean { return !process.env.INSTAGRAM_APP_ID; }

interface IGMediaResponse {
  id: string;
  status_code?: string;
}

interface IGInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>;
}

export class InstagramPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    private readonly igUserId: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[InstagramPublisher] Mock mode — INSTAGRAM_APP_ID missing');
      return `mock_instagram_${Date.now()}`;
    }

    const hashtags = meta.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
        const caption = `${adCaption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`;

    // Step 1: Create media container
    const containerRes = await fetch(`${GRAPH_BASE}/${this.igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: videoUrl,
        caption: caption.slice(0, 2200),
        media_type: 'REELS',
        access_token: this.accessToken,
      }),
    });

    if (!containerRes.ok) {
      const text = await containerRes.text();
      throw new Error(`Instagram media container creation failed (${containerRes.status}): ${text}`);
    }

    const container = (await containerRes.json()) as IGMediaResponse;
    const containerId = container.id;

    // Step 2: Publish
    const publishRes = await fetch(`${GRAPH_BASE}/${this.igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: this.accessToken,
      }),
    });

    if (!publishRes.ok) {
      const text = await publishRes.text();
      throw new Error(`Instagram media publish failed (${publishRes.status}): ${text}`);
    }

    const published = (await publishRes.json()) as IGMediaResponse;
    return published.id;
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

    const res = await fetch(
      `${GRAPH_BASE}/${externalPostId}?fields=status_code&access_token=${this.accessToken}`,
    );

    if (!res.ok) return 'processing';

    const data = (await res.json()) as IGMediaResponse;
    const code = data.status_code;

    if (code === 'FINISHED' || code === 'PUBLISHED') return 'live';
    if (code === 'ERROR') return 'failed';
    return 'processing';
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0 };
    }

    const res = await fetch(
      `${GRAPH_BASE}/${externalPostId}/insights?metric=impressions,reach,likes,comments&access_token=${this.accessToken}`,
    );

    if (!res.ok) return { views: 0, likes: 0, comments: 0 };

    const data = (await res.json()) as IGInsightsResponse;
    const find = (name: string) =>
      data.data?.find(m => m.name === name)?.values?.[0]?.value ?? 0;

    return {
      views: find('impressions'),
      reach: find('reach'),
      likes: find('likes'),
      comments: find('comments'),
    };
  }
}
