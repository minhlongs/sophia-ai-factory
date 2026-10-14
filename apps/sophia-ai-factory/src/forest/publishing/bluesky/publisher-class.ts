/**
 * Bluesky Publisher Implementation
 * Layer: FOREST (Infrastructure Orchestration)
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from '../publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { SERVICE_NAME, DEFAULT_PDS, isMockMode, type AtprotoCreateRecordResponse } from './types';
import { buildPostText, buildFacets } from './post-formatter';

export class BlueskyPublisher implements Publisher {
  private readonly pdsUrl: string;

  constructor(
    private readonly accessJwt: string,
    private readonly did: string,
  ) {
    this.pdsUrl = (process.env.BLUESKY_PDS_URL ?? DEFAULT_PDS).replace(/\/$/, '');
  }

  async upload(_videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[BlueskyPublisher] Mock mode — BLUESKY_PDS_URL missing');
      return `mock_bluesky_${Date.now()}`;
    }
    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
    }

    const text = buildPostText(meta);
    const createdAt = new Date().toISOString();
    const facets = buildFacets(text, meta.hashtags);

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt,
    };
    if (facets.length > 0) record.facets = facets;

    try {
      const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: this.did,
          collection: 'app.bsky.feed.post',
          record,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch((err) => {
          logger.warn('Failed to read Bluesky createRecord response', { error: String(err), context: 'BlueskyPublisher.upload' });
          return '';
        });
        recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
        throw new Error(`Bluesky createRecord failed (${res.status}): ${body.slice(0, 300)}`);
      }

      recordSuccess(SERVICE_NAME);
      const data = (await res.json()) as AtprotoCreateRecordResponse;
      if (!data.uri) {
        throw new Error(`Bluesky createRecord returned no uri: ${data.message ?? data.error ?? 'unknown'}`);
      }
      // uri format: at://did:plc:xxx/app.bsky.feed.post/rkey — use rkey as external post id
      const rkey = data.uri.split('/').pop() ?? data.uri;
      return rkey;
    } catch (error) {
      if (error instanceof Error && error.message.includes('[circuit-breaker]')) throw error;
      recordFailure(SERVICE_NAME, classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';
    return 'live';
  }

  async getMetrics(_externalPostId: string): Promise<MetricsJson> {
    return { views: 0, likes: 0, comments: 0 };
  }
}
