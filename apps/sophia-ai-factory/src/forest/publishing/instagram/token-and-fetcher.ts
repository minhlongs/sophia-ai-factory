import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { decryptToken } from '@/tree/crypto/token-crypto';
import { refreshInstagramLongLivedToken } from '@/forest/publishing/oauth-platform-refreshers';
import { InstagramReelsMetrics, InstagramPostRow } from './types';

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

export async function fetchInstagramReelsMetrics(
  accessToken: string,
  mediaId: string,
): Promise<InstagramReelsMetrics> {
  if (process.env.NODE_ENV === 'test' && accessToken === 'mock_ig_token') {
    return { views: 0, reach: 0, likes: 0, comments: 0, shares: 0 };
  }

  const res = await fetch(
    `${GRAPH_BASE}/${mediaId}/insights?metric=impressions,reach,likes,comments,shares&access_token=${accessToken}`,
  );

  if (!res.ok) {
    throw new Error(`Instagram Insights API returned status ${res.status}`);
  }

  interface IGInsightsData {
    data?: Array<{ name: string; values?: Array<{ value: number }> }>;
  }
  const data = (await res.json()) as IGInsightsData;
  const find = (name: string) =>
    data.data?.find((m) => m.name === name)?.values?.[0]?.value ?? 0;

  return {
    views: find('impressions'),
    reach: find('reach'),
    likes: find('likes'),
    comments: find('comments'),
    shares: find('shares'),
  };
}

export async function resolveAccessToken(
  db: Awaited<ReturnType<typeof getD1>>,
  post: InstagramPostRow,
  tokenCache: Map<string, string>,
  nowSec: number,
): Promise<string> {
  if (!post.access_token) {
    return 'mock_ig_token';
  }

  const cacheKey = post.channel_id ?? post.tenant_id;
  const cached = tokenCache.get(cacheKey);
  if (cached) return cached;

  let rawTok = await decryptToken(post.access_token);

  // Auto-refresh token if within 1 day of expiration
  if (post.expires_at && nowSec >= post.expires_at - 86400) {
    try {
      const refreshed = await refreshInstagramLongLivedToken(rawTok);
      rawTok = refreshed.access_token;
      if (post.channel_id && db) {
        await db
          .prepare(
            `UPDATE publishing_channels
             SET access_token = ?, expires_at = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(rawTok, nowSec + (refreshed.expires_in ?? 5184000), nowSec, post.channel_id)
          .run()
          .catch(() => {});
      }
    } catch (refErr) {
      logger.warn('[instagram-metrics-harvester] Token refresh failed, using existing', {
        channelId: post.channel_id,
        err: String(refErr),
      });
    }
  }

  tokenCache.set(cacheKey, rawTok);
  return rawTok;
}
