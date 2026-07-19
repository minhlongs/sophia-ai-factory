/**
 * Engagement Collector — Inngest cron function (runs hourly).
 *
 * For each recently-published item (last 7 days), calls the appropriate
 * Publisher.getMetrics() and stores normalized results in engagement_metrics.
 *
 * Rate limit: max 50 rows per cron run.
 * Dead-letter: items that fail 3+ times are skipped (logged).
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { getD1, type D1Database } from '@/seed/db/client';
import { normalizeMetrics, type NormalizedMetrics } from '@/seed/utils/metrics-normalizer';
import type { MetricsJson } from '@/seed/types/channel-provider';
import type { ChannelProvider } from '@/land/video/publishing/providers/publisher-interface';

// ── Constants ────────────────────────────────────────────────────────────────

/** Max rows to process in a single cron run */
const BATCH_LIMIT = 50;
/** Max failed attempts before an entry is dead-lettered */
const MAX_ATTEMPTS = 3;
/** Look back 7 days for published items */
const LOOKBACK_SECONDS = 7 * 24 * 60 * 60;

// ── Supported channels for engagement collection ─────────────────────────────

const ENGAGEMENT_CHANNELS: ChannelProvider[] = [
  'youtube',
  'tiktok',
  'telegram',
  'instagram',
  'facebook',
];

// ── Inngest Function ─────────────────────────────────────────────────────────

export const engagementCollector = inngest.createFunction(
  { id: 'engagement-collector', retries: 0 },
  { cron: '0 * * * *' }, // hourly
  async ({ step }) => {
    const db = getD1();
    if (!db) {
      logger.error('[engagement-collector] D1 binding not available');
      return { error: 'd1_unavailable', rowsProcessed: 0 };
    }

    // Step 1: Fetch up to BATCH_LIMIT published jobs from the last 7 days
    const cutoff = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS;

    const publishedJobs = await step.run(
      'fetch-published-jobs',
      async (): Promise<
        Array<{ id: string; provider: string; channel_post_id: string }>
      > => {
        try {
          const result = await db
            .prepare(
              `SELECT pr.id, pj.provider, pr.channel_post_id
               FROM publishing_results pr
               JOIN publishing_jobs pj ON pj.id = pr.publishing_job_id
               WHERE pr.published_at > ?1 AND pj.provider IN ('youtube','tiktok','telegram','instagram','facebook')
               LIMIT ?2`,
            )
            .bind(cutoff, BATCH_LIMIT)
            .all<{ id: string; provider: string; channel_post_id: string }>();
          return result.results;
        } catch {
          return [];
        }
      },
    );

    if (publishedJobs.length === 0) {
      logger.info('[engagement-collector] No published jobs to process');
      return { rowsProcessed: 0, message: 'no_jobs' };
    }

    // Step 2: For each job, attempt to fetch metrics
    const results: Array<{ jobId: string; status: string }> = [];

    for (const job of publishedJobs) {
      if (results.length >= BATCH_LIMIT) break;

      const { id: jobId, provider, channel_post_id: postId } = job;

      const metrics = await step.run(
        `fetch-${jobId}`,
        async (): Promise<NormalizedMetrics | null> => {
          const raw = await fetchMetrics(provider, postId);
          if (!raw) return null;
          return normalizeMetrics(raw, provider, postId);
        },
      );

      if (!metrics) {
        await handleFailure(db, jobId);
        results.push({ jobId, status: 'skipped' });
        continue;
      }

      // Step 3: Insert into engagement_metrics
      await step.run(`insert-${jobId}`, async () => {
        try {
          db.prepare(
            `INSERT INTO engagement_metrics (channel, post_id, views, likes, comments, shares, engagement_rate, collected_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
          )
            .bind(
              metrics.platform,
              metrics.postId,
              metrics.views,
              metrics.likes,
              metrics.comments,
              metrics.shares,
              metrics.engagementRate,
              metrics.collectedAt,
            )
            .run();
        } catch (err) {
          logger.warn('[engagement-collector] Insert failed', {
            jobId,
            error: err instanceof Error ? err.message : String(err),
          });
          await handleFailure(db, jobId);
          results.push({ jobId, status: 'insert_failed' });
          return null;
        }
        return { jobId, status: 'ok' };
      });

      if (results[results.length - 1]?.status === 'ok') {
        await resetAttempts(db, jobId);
      }
    }

    const okCount = results.filter((r) => r.status === 'ok').length;
    logger.info('[engagement-collector] Run complete', {
      total: publishedJobs.length,
      ok: okCount,
      skipped: results.filter((r) => r.status === 'skipped').length,
    });

    return { rowsProcessed: publishedJobs.length, okCount };
  },
);

// ── Helpers ──────────────────────────────────────────────────────────────────

interface PublisherLike {
  getMetrics(externalPostId: string): Promise<MetricsJson>;
}

/**
 * Dynamic publisher lookup — we import lazily to avoid
 * importing all publishers at module load time.
 */
async function getPublisher(provider: string): Promise<PublisherLike | null> {
  const channelMap: Record<string, () => Promise<PublisherLike | null>> = {
    youtube: async () => {
      const mod = await import('@/land/video/publishing/providers/youtube-publisher');
      return mod.YouTubePublisher as unknown as PublisherLike;
    },
    tiktok: async () => {
      const mod = await import('@/land/video/publishing/providers/tiktok-publisher');
      return mod.TikTokPublisher as unknown as PublisherLike;
    },
    telegram: async () => {
      const mod = await import('@/land/video/publishing/providers/telegram-publisher');
      return mod.TelegramPublisher as unknown as PublisherLike;
    },
    instagram: async () => {
      const mod = await import('@/land/video/publishing/providers/instagram-publisher');
      return mod.InstagramPublisher as unknown as PublisherLike;
    },
    facebook: async () => {
      const mod = await import('@/land/video/publishing/providers/facebook-publisher');
      return mod.FacebookPublisher as unknown as PublisherLike;
    },
  };

  const loader = channelMap[provider];
  if (!loader) return null;

  try {
    return await loader();
  } catch {
    return null;
  }
}

/**
 * Fetch metrics from a publisher — returns null on any failure.
 */
async function fetchMetrics(
  provider: string,
  postId: string,
): Promise<MetricsJson | null> {
  const publisher = await getPublisher(provider);
  if (!publisher) {
    logger.debug('[engagement-collector] No publisher for channel', { provider });
    return null;
  }
  try {
    return await publisher.getMetrics(postId);
  } catch (err) {
    logger.debug('[engagement-collector] getMetrics failed', {
      provider,
      postId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Handle a failed row — increment attempt count, dead-letter if max reached.
 */
async function handleFailure(db: D1Database, jobId: string) {
  try {
    const existing = await db
      .prepare(
        'SELECT attempt_count FROM engagement_failures WHERE job_id = ?1',
      )
      .bind(jobId)
      .first<{ attempt_count: number }>();

    const newCount = (existing?.attempt_count ?? 0) + 1;

    db.prepare(
      `INSERT INTO engagement_failures (job_id, attempt_count, last_error, failed_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(job_id) DO UPDATE SET
         attempt_count = excluded.attempt_count,
         last_error = excluded.last_error,
         failed_at = excluded.failed_at`,
    )
      .bind(jobId, newCount, 'get_metrics_failed', Math.floor(Date.now() / 1000))
      .run();

    if (newCount >= MAX_ATTEMPTS) {
      logger.warn('[engagement-collector] Dead-lettered job', {
        jobId,
        attempts: newCount,
      });
    }
  } catch {
    // table may not exist yet — non-critical
  }
}

/**
 * Reset attempt counter on successful insert.
 */
async function resetAttempts(db: D1Database, jobId: string) {
  if (!db) return;
 try {
    db.prepare('DELETE FROM engagement_failures WHERE job_id = ?1')
      .bind(jobId)
      .run();
  } catch {
    // non-critical
  }
}
