/**
 * Anti-collision slot lookup and D1 job row insertion for publishing scheduler.
 * @module forest/publishing/scheduler-ops/slot-persistence
 */

import { randomUUID } from 'crypto';
import type { D1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Database anti-collision loop — finds an available slot without conflicting scheduled jobs.
 */
export async function findAvailablePublishSlot(
  db: D1Client,
  tenantId: string,
  channelId: string,
  startScheduledAt: number,
): Promise<number> {
  const MAX_CONFLICT_ITERATIONS = 48;
  let effectiveScheduledAt = startScheduledAt;
  let conflictFound = true;
  let conflictIterations = 0;

  while (conflictFound) {
    const minTime = effectiveScheduledAt - 299;
    const maxTime = effectiveScheduledAt + 299;

    const { data: existingJobs } = await db
      .from('publishing_jobs')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('channel_id', channelId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', minTime)
      .lte('scheduled_at', maxTime);

    if (existingJobs && existingJobs.length > 0) {
      conflictIterations++;
      if (conflictIterations >= MAX_CONFLICT_ITERATIONS) {
        logger.warn('[Scheduler] Anti-collision cap reached — accepting conflicting slot', {
          channelId,
          effectiveScheduledAt,
          iterations: conflictIterations,
        });
        conflictFound = false;
      } else {
        effectiveScheduledAt += 300;
      }
    } else {
      conflictFound = false;
    }
  }

  return effectiveScheduledAt;
}

/**
 * Persists a new scheduled publishing job row in database.
 */
export async function insertPublishingJobRow(
  db: D1Client,
  params: {
    tenantId: string;
    videoJobId: string;
    channelId: string;
    caption: string;
    hashtagsJson: string;
    productLink?: string;
    scheduledAt: number;
    nowSec: number;
  },
): Promise<string> {
  const jobId = randomUUID();
  await db.from('publishing_jobs').insert({
    id: jobId,
    tenant_id: params.tenantId,
    video_id: params.videoJobId,
    channel_id: params.channelId,
    status: 'scheduled',
    caption: params.caption,
    hashtags_json: params.hashtagsJson,
    product_link: params.productLink ?? null,
    scheduled_at: params.scheduledAt,
    started_at: null,
    finished_at: null,
    retry_count: 0,
    error: null,
    created_at: params.nowSec,
  });
  return jobId;
}
