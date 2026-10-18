/**
 * Fair-Share GPU Scheduler: Job State Transitions
 *
 * Implements markJobRendering, completeJob, and failJob (with DLQ routing).
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/scheduler/job-state-transitions
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
export { failJob } from './job-failure-handler';

/**
 * Transition a job from leased to rendering
 */
export async function markJobRendering(
  db: D1Database,
  jobId: string,
  workerId: string,
  provider?: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);

  const res = await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = 'rendering',
           provider = COALESCE(?, provider),
           updated_at = ?
       WHERE id = ? AND (status = 'leased' OR status = 'rendering') AND leased_by = ?`,
    )
    .bind(provider || null, now, jobId, workerId)
    .run();

  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Complete a render job with the resulting asset URL
 */
export async function completeJob(
  db: D1Database,
  jobId: string,
  resultUrl: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);

  const res = await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = 'completed',
           result_url = ?,
           leased_by = NULL,
           leased_until = NULL,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(resultUrl, now, jobId)
    .run();

  const success = (res.meta?.changes ?? 0) > 0;
  if (success) {
    logger.info(`[gpu-scheduler] Job ${jobId} completed with resultUrl=${resultUrl}`);
  }
  return success;
}
