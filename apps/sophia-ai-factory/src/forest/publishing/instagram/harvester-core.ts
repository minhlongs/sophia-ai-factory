import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  HarvestInstagramOptions,
  HarvestResult,
  InstagramPostRow,
} from './types';
import {
  fetchInstagramReelsMetrics,
  resolveAccessToken,
} from './token-and-fetcher';
import { persistHarvestedMetrics } from './metrics-persistence';

export async function queryPublishedInstagramPosts(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  limit: number,
): Promise<InstagramPostRow[]> {
  const { results: rawPosts } = await db
    .prepare(
      `SELECT DISTINCT
         r.tenant_id,
         j.video_id,
         r.channel_post_id,
         j.channel_id,
         c.access_token,
         c.external_account_id,
         c.expires_at
       FROM publishing_results r
       JOIN publishing_jobs j ON j.id = r.publishing_job_id
       LEFT JOIN publishing_channels c ON c.id = j.channel_id
       WHERE j.provider = 'instagram'
         AND r.channel_post_id IS NOT NULL
       ORDER BY r.published_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<InstagramPostRow>();

  if (rawPosts && rawPosts.length > 0) {
    return rawPosts;
  }

  const { results: vpResults } = await db
    .prepare(
      `SELECT DISTINCT
         vp.user_id AS tenant_id,
         vp.video_id,
         vp.platform_video_id AS channel_post_id,
         c.id AS channel_id,
         c.access_token,
         c.external_account_id,
         c.expires_at
       FROM video_publishes vp
       LEFT JOIN publishing_channels c ON c.tenant_id = vp.user_id AND c.provider = 'instagram' AND c.status = 'active'
       WHERE vp.platform = 'instagram'
         AND vp.status = 'published'
         AND vp.platform_video_id IS NOT NULL
       LIMIT ?`,
    )
    .bind(limit)
    .all<InstagramPostRow>();

  return vpResults ?? [];
}

export async function harvestInstagramReelsMetrics(
  options?: HarvestInstagramOptions,
): Promise<HarvestResult> {
  const db = await getD1();
  if (!db) {
    logger.warn('[instagram-metrics-harvester] D1 unavailable');
    return { totalFound: 0, harvested: 0, errors: 0 };
  }

  const limit = options?.limit ?? 50;
  const posts = await queryPublishedInstagramPosts(db, limit);

  if (posts.length === 0) {
    logger.info('[instagram-metrics-harvester] No published Instagram reels found');
    return { totalFound: 0, harvested: 0, errors: 0 };
  }

  let harvested = 0;
  let errors = 0;
  const today = new Date().toISOString().slice(0, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  const tokenCache = new Map<string, string>();
  const metricsFetcher = options?.fetchMetrics ?? fetchInstagramReelsMetrics;

  for (const post of posts) {
    try {
      const accessToken = await resolveAccessToken(db, post, tokenCache, nowSec);
      const metrics = await metricsFetcher(accessToken, post.channel_post_id);
      await persistHarvestedMetrics(db, post, metrics, today, nowSec);
      harvested++;
    } catch (postErr) {
      errors++;
      logger.warn('[instagram-metrics-harvester] Failed harvesting post', {
        postId: post.channel_post_id,
        err: String(postErr),
      });
    }
  }

  return { totalFound: posts.length, harvested, errors };
}
