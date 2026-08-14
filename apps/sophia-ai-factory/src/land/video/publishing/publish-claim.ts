/**
 * Job claim logic for video publishing: fetch job, check retries, atomic claim.
 * @module land/video/publishing/publish-claim
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingJob } from '@/seed/types';

const MAX_RETRIES = 3;

export async function findJobById(db: ReturnType<typeof createServerClient>, jobId: string): Promise<PublishingJob | null> {
  const { data: jobData } = await db
    .from('publishing_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  const job = jobData as PublishingJob | null;
  return job;
}

export async function checkAndMarkMaxRetries(db: ReturnType<typeof createServerClient>, jobId: string, job: PublishingJob): Promise<boolean> {
  if (job.retry_count >= MAX_RETRIES) {
    await db.from('publishing_jobs').update({
      status: 'failed',
      error: 'Max retries exceeded',
    }).eq('id', jobId);

    logger.warn('[publishExecute] Max retries exceeded', { jobId, retryCount: job.retry_count });
    return true;
  }
  return false;
}

export async function atomicClaimJob(db: ReturnType<typeof createServerClient>, jobId: string): Promise<{ claimed: boolean; status: string }> {
  const claimUpdate = await db
    .from('publishing_jobs')
    .update({
      status: 'uploading',
      started_at: Math.floor(Date.now() / 1000),
    })
    .eq('id', jobId)
    .eq('status', 'scheduled');

  const claimChanges = (claimUpdate as { meta?: { changes?: number } })?.meta?.changes ?? 0;
  if (claimChanges === 0) {
    return { claimed: false, status: 'scheduled' };
  }
  return { claimed: true, status: 'uploading' };
}
