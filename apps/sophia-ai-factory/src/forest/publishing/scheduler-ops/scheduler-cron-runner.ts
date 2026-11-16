/**
 * Idempotent Scheduler Cron Processor (atomic OCC CAS job claiming).
 * @module forest/publishing/scheduler-ops/scheduler-cron-runner
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { SYSTEM_REQUESTER_SENTINEL } from '@/tree/publishing/approval';
import { producePublishProvenance } from '@/tree/youtube-strategy/provenance-producer';
import type { SchedulerCronResult } from './types';

export async function runSchedulerCron(options?: {
  nowSec?: number;
  limit?: number;
}): Promise<SchedulerCronResult> {
  const db = createServerClient();
  const now = options?.nowSec ?? Math.floor(Date.now() / 1000);
  const limit = options?.limit ?? 50;

  // Query jobs due for dispatch (publishing_jobs schema has caption, no title column)
  const { data: dueJobs, error } = await db
    .from('publishing_jobs')
    .select('id, tenant_id, channel_id, caption, scheduled_at, status')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    const errMsg = typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
    logger.error('[SchedulerCron] Failed to query due publishing_jobs', new Error(errMsg));
    throw new Error(`[SchedulerCron] Query due jobs failed: ${errMsg}`);
  }

  const jobs = (dueJobs ?? []) as Array<{
    id: string;
    tenant_id: string;
    channel_id: string;
    caption?: string | null;
    scheduled_at: number;
    status: string;
  }>;

  if (jobs.length === 0) {
    return { processed: 0, dispatched: [], skipped: 0 };
  }

  const dispatched: string[] = [];
  const skipped = 0;

  for (const job of jobs) {
    const provenance = producePublishProvenance({ caption: job.caption ?? '' });
    // Keep the durable row scheduled until the worker starts. If event dispatch
    // fails, the next cron can discover it again; if duplicate events arrive,
    // the worker's scheduled -> uploading CAS permits only one provider call.
    await inngest.send({
      id: `publish-${job.id}-due`,
      name: 'publish.scheduled',
      data: {
        jobId: job.id,
        tenantId: job.tenant_id,
        // Automated cron sweeps have no signed-in requester; use the system
        // sentinel so downstream publish_ledger.requester_id stays null rather
        // than recording the workspace id as a human requester.
        userId: SYSTEM_REQUESTER_SENTINEL,
        provenance,
      },
    });

    dispatched.push(job.id);
    logger.info('[SchedulerCron] Dispatched due job for worker claim', {
      jobId: job.id,
      channelId: job.channel_id,
      scheduledAt: job.scheduled_at,
    });
  }

  return { processed: jobs.length, dispatched, skipped };
}
