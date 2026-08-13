/**
 * Bluesky Publisher Adapter — AT Protocol, app-password flow.
 * No OAuth — user provides handle + app-password.
 * Session: com.atproto.server.createSession → accessJwt + refreshJwt.
 * Post: com.atproto.repo.createRecord (app.bsky.feed.post lexicon).
 * Falls back to mock responses when BLUESKY_PDS_URL is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const DEFAULT_PDS = 'https://bsky.social';
const MAX_POST_LENGTH = 300;

function isMockMode(): boolean {
  return !process.env.BLUESKY_PDS_URL;
}

interface AtprotoCreateRecordResponse {
  uri?: string;
  cid?: string;
  error?: string;
  message?: string;
}

function buildPostText(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ? `\n\n${meta.productLink}` : '';
  const full = `${adCaption}${tags ? ` ${tags}` : ''}${link}`;
  return full.length > MAX_POST_LENGTH ? full.slice(0, MAX_POST_LENGTH - 1) + '…' : full;
}

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
    if (!shouldAllowRequest('bluesky')) {
      throw new Error('[BlueskyPublisher] Circuit breaker open for bluesky');
    }

    const text = buildPostText(meta);
    const createdAt = new Date().toISOString();

    // Build facets for hashtags (byte-range links)
    const facets: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ $type: string; tag: string }>;
    }> = [];
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    for (const tag of meta.hashtags) {
      const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
      const tagBytes = encoder.encode(normalizedTag);
      let offset = 0;
      while (offset < textBytes.length) {
        const slice = textBytes.slice(offset, offset + tagBytes.length);
        if (slice.every((b, i) => b === tagBytes[i])) {
          facets.push({
            index: { byteStart: offset, byteEnd: offset + tagBytes.length },
            features: [{ $type: 'app.bsky.richtext.facet#tag', tag: normalizedTag.slice(1) }],
          });
          break;
        }
        offset++;
      }
    }

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
        recordFailure('bluesky', classifyError(new Error(`HTTP ${res.status}`)));
        throw new Error(`Bluesky createRecord failed (${res.status}): ${body.slice(0, 300)}`);
      }

      recordSuccess('bluesky');
      const data = (await res.json()) as AtprotoCreateRecordResponse;
      if (!data.uri) {
        throw new Error(`Bluesky createRecord returned no uri: ${data.message ?? data.error ?? 'unknown'}`);
      }
      // uri format: at://did:plc:xxx/app.bsky.feed.post/rkey — use rkey as external post id
      const rkey = data.uri.split('/').pop() ?? data.uri;
      return rkey;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
      recordFailure('bluesky', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    // AT Protocol posts are synchronous — published on createRecord success
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';
    return 'live';
  }

  async getMetrics(_externalPostId: string): Promise<MetricsJson> {
    // AT Protocol does not expose per-post metrics via public API yet
    return { views: 0, likes: 0, comments: 0 };
  }
}

/** Create an AT Protocol session via app-password. Returns accessJwt, refreshJwt, did. */
export async function createAtprotoSession(
  identifier: string,
  appPassword: string,
  pdsUrl?: string,
): Promise<{ accessJwt: string; refreshJwt: string; did: string; handle: string }> {
  if (!shouldAllowRequest('bluesky')) {
    throw new Error('[Bluesky] Circuit breaker open for bluesky');
  }
  const base = (pdsUrl ?? process.env.BLUESKY_PDS_URL ?? DEFAULT_PDS).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: appPassword }),
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read Bluesky createSession response', { error: String(err), context: 'createAtprotoSession' });
        return '';
      });
      recordFailure('bluesky', classifyError(new Error(`HTTP ${res.status}`)));
      throw new Error(`Bluesky createSession failed (${res.status}): ${body.slice(0, 200)}`);
    }
    recordSuccess('bluesky');
    const data = (await res.json()) as {
      accessJwt?: string;
      refreshJwt?: string;
      did?: string;
      handle?: string;
      error?: string;
      message?: string;
    };
    if (!data.accessJwt || !data.did) {
      throw new Error(`Bluesky createSession returned no session: ${data.message ?? data.error ?? 'unknown'}`);
    }
    logger.info('[bluesky] Session created', { did: data.did });
    return {
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt ?? '',
      did: data.did,
      handle: data.handle ?? identifier,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('bluesky', classifyError(error));
    throw error;
  }
}

/** Refresh an AT Protocol session using refreshJwt. */
export async function refreshAtprotoSession(
  refreshJwt: string,
  pdsUrl?: string,
): Promise<{ accessJwt: string; refreshJwt: string; did: string }> {
  if (!shouldAllowRequest('bluesky')) {
    throw new Error('[Bluesky] Circuit breaker open for bluesky');
  }
  const base = (pdsUrl ?? process.env.BLUESKY_PDS_URL ?? DEFAULT_PDS).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/xrpc/com.atproto.server.refreshSession`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshJwt}` },
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read Bluesky refreshSession response', { error: String(err), context: 'refreshAtprotoSession' });
        return '';
      });
      recordFailure('bluesky', classifyError(new Error(`HTTP ${res.status}`)));
      throw new Error(`Bluesky refreshSession failed (${res.status}): ${body.slice(0, 200)}`);
    }
    recordSuccess('bluesky');
    const data = (await res.json()) as {
      accessJwt?: string;
      refreshJwt?: string;
      did?: string;
    };
    if (!data.accessJwt || !data.did) throw new Error('Bluesky refreshSession returned no tokens');
    return {
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt ?? refreshJwt,
      did: data.did,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('bluesky', classifyError(error));
    throw error;
  }
}
