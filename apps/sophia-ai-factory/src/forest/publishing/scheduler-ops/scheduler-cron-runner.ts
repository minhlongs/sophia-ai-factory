/**
 * Idempotent Scheduler Cron Processor (atomic OCC CAS job claiming).
 * @module forest/publishing/scheduler-ops/scheduler-cron-runner
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import type { SchedulerCronResult } from './types';

export async function runSchedulerCron(options?: {
  nowSec?: number;
  limit?: number;
}): Promise<SchedulerCronResult> {
  const db = createServerClient();
  const now = options?.nowSec ?? Math.floor(Date.now() / 1000);
  const limit = options?.limit ?? 50;

  // Query jobs due for dispatch
  const { data: dueJobs } = await db
    .from('publishing_jobs')
    .select('id, tenant_id, channel_id, scheduled_at, status')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  const jobs = (dueJobs ?? []) as Array<{
    id: string;
    tenant_id: string;
    channel_id: string;
    scheduled_at: number;
    status: string;
  }>;

  if (jobs.length === 0) {
    return { processed: 0, dispatched: [], skipped: 0 };
  }

  const { atomicClaimJob } = await import('@/land/video/publishing/publish-claim');

  const dispatched: string[] = [];
  let skipped = 0;

  for (const job of jobs) {
    // Atomic OCC CAS claim: scheduled -> uploading
    const { claimed } = await atomicClaimJob(db, job.id);
    if (!claimed) {
      skipped++;
      logger.info('[SchedulerCron] Job already claimed concurrently — skipping', {
        jobId: job.id,
      });
      continue;
    }

    // Dispatched to Inngest with alreadyClaimed=true
    await inngest.send({
      id: `publish-${job.id}-due`,
      name: 'publish.scheduled',
      data: {
        jobId: job.id,
        tenantId: job.tenant_id,
        userId: job.tenant_id,
        alreadyClaimed: true,
      },
    });

    dispatched.push(job.id);
    logger.info('[SchedulerCron] Claimed and dispatched due job', {
      jobId: job.id,
      channelId: job.channel_id,
      scheduledAt: job.scheduled_at,
    });
  }

  return { processed: jobs.length, dispatched, skipped };
}
