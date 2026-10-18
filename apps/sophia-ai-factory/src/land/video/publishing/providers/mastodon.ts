/**
 * Mastodon Publisher Adapter — /api/v1/statuses.
 * Instance URL is encoded in external_account_id as "<instanceUrl>|<accountId>".
 * Posts as text status with video URL + caption (Mastodon has no native video API for all instances).
 * Falls back to mock responses when MASTODON_INSTANCE_URL is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  isMockMode,
  buildStatusText,
  parseExternalAccountId,
  ZERO_MASTODON_METRICS,
  type MastodonStatusResponse,
  type MastodonStatusStats,
} from './mastodon-helpers';

export { parseExternalAccountId };

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

    if (shouldAllowRequest('mastodon') === false) {
      throw new Error('Circuit breaker open for mastodon');
    }

    try {
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
        const body = await res.text().catch((err) => {
          logger.warn('Failed to read Mastodon status response', {
            error: String(err),
            context: 'MastodonPublisher.upload',
          });
          return '';
        });
        const err = new Error(`Mastodon /api/v1/statuses failed (${res.status}): ${body.slice(0, 300)}`);
        recordFailure('mastodon', classifyError(err));
        throw err;
      }

      const data = (await res.json()) as MastodonStatusResponse;
      if (!data.id) {
        throw new Error(`Mastodon status returned no id: ${data.error ?? 'unknown'}`);
      }
      recordSuccess('mastodon');
      return data.id;
    } catch (error) {
      recordFailure('mastodon', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
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
      return { ...ZERO_MASTODON_METRICS };
    }
    const res = await fetch(`${this.instanceUrl}/api/v1/statuses/${externalPostId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) return { ...ZERO_MASTODON_METRICS };
    const data = (await res.json()) as MastodonStatusStats;
    return {
      views: 0,
      likes: data.favourites_count ?? 0,
      comments: data.replies_count ?? 0,
      shares: data.reblogs_count ?? 0,
    };
  }

  async delete(_postId: string): Promise<void> {
    logger.warn('[mastodon.ts] delete not implemented');
  }
}
