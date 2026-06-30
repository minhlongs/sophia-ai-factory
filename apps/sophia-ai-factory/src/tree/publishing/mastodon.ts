/**
 * Mastodon Publisher Adapter — /api/v1/statuses.
 * Instance URL is encoded in external_account_id as "<instanceUrl>|<accountId>".
 * Posts as text status with video URL + caption (Mastodon has no native video API for all instances).
 * Falls back to mock responses when MASTODON_INSTANCE_URL is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from '@/seed/types/channel-provider';
import { logger } from '@/seed/utils/logger-utility';

const MAX_STATUS_LENGTH = 500;

function isMockMode(): boolean {
  return !process.env.MASTODON_INSTANCE_URL;
}

interface MastodonStatusResponse {
  id?: string;
  uri?: string;
  error?: string;
}

interface MastodonStatusStats {
  id?: string;
  replies_count?: number;
  reblogs_count?: number;
  favourites_count?: number;
}

function buildStatusText(meta: PublishMeta, videoUrl: string): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ?? videoUrl;
  const full = `${adCaption}${tags ? ` ${tags}` : ''}\n\n${link}`;
  return full.length > MAX_STATUS_LENGTH ? full.slice(0, MAX_STATUS_LENGTH - 1) + '…' : full;
}

/** Parse instanceUrl from compound external_account_id "<instanceUrl>|<accountId>" */
export function parseExternalAccountId(externalAccountId: string): { instanceUrl: string; accountId: string } {
  const separatorIdx = externalAccountId.lastIndexOf('|');
  if (separatorIdx === -1) {
    // Fallback: treat entire value as accountId with default instance
    return {
      instanceUrl: process.env.MASTODON_INSTANCE_URL ?? 'https://mastodon.social',
      accountId: externalAccountId,
    };
  }
  return {
    instanceUrl: externalAccountId.slice(0, separatorIdx),
    accountId: externalAccountId.slice(separatorIdx + 1),
  };
}

export class MastodonPublisher implements Publisher {
  private readonly instanceUrl: string;

  constructor(
    private readonly accessToken: string,
    /** "<instanceUrl>|<accountId>" compound identifier */
    private readonly externalAccountId: string,
  ) {
    const { instanceUrl } = parseExternalAccountId(externalAccountId);
    this.instanceUrl = instanceUrl.replace(/\/$/, '');
  }

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[MastodonPublisher] Mock mode — MASTODON_INSTANCE_URL missing');
      return `mock_mastodon_${Date.now()}`;
    }

    const status = buildStatusText(meta, videoUrl);

    const res = await fetch(`${this.instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, visibility: 'public' }),
    });

    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
      } catch (err) {
        logger.warn('Failed to read Mastodon response body', undefined, { error: String(err), context: 'MastodonPublisher.upload' });
      }
      throw new Error(`Mastodon /api/v1/statuses failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as MastodonStatusResponse;
    if (!data.id) {
      throw new Error(`Mastodon status returned no id: ${data.error ?? 'unknown'}`);
    }
    return data.id;
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    // Mastodon posts are synchronous
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';
    const res = await fetch(`${this.instanceUrl}/api/v1/statuses/${externalPostId}`, {
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
    const res = await fetch(`${this.instanceUrl}/api/v1/statuses/${externalPostId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) return { views: 0, likes: 0, comments: 0, shares: 0 };
    const data = (await res.json()) as MastodonStatusStats;
    return {
      views: 0,
      likes: data.favourites_count ?? 0,
      comments: data.replies_count ?? 0,
      shares: data.reblogs_count ?? 0,
    };
  }

async delete(postId: string): Promise<void> {
  // Platform-specific deletion not implemented
  logger.warn("[mastodon.ts] delete not implemented");
}}
