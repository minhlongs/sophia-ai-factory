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
import type {
  VideoRenderJob,
  VideoRenderRow,
  JobStatus,
} from '@/seed/types/video-render-queue';
import { mapRowToJob } from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';

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

/**
 * Record a failure on a job, incrementing retry count and routing to DLQ if max retries reached
 */
export async function failJob(
  db: D1Database,
  jobId: string,
  errorMessage: string,
  options?: { routeToDlq?: boolean; dlqReason?: string },
): Promise<{
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  shouldDlq: boolean;
  job?: VideoRenderJob;
}> {
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .prepare(`SELECT * FROM video_render_jobs WHERE id = ?`)
    .bind(jobId)
    .first<VideoRenderRow>();

  if (!existing) {
    throw new Error(`Job ${jobId} not found`);
  }

  const nextRetryCount = existing.retry_count + 1;
  const isDlq = options?.routeToDlq || nextRetryCount >= existing.max_retries;
  const nextStatus: JobStatus = isDlq ? 'dlq' : 'queued';
  const dlqReason = isDlq
    ? options?.dlqReason || (nextRetryCount >= existing.max_retries ? 'MAX_RETRIES_EXCEEDED' : 'FATAL_ERROR')
    : null;

  await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = ?,
           error_message = ?,
           retry_count = ?,
           dlq_reason = ?,
           leased_by = NULL,
           leased_until = NULL,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(nextStatus, errorMessage, nextRetryCount, dlqReason, now, jobId)
    .run();

  const updatedRow: VideoRenderRow = {
    ...existing,
    status: nextStatus,
    error_message: errorMessage,
    retry_count: nextRetryCount,
    dlq_reason: dlqReason,
    leased_by: null,
    leased_until: null,
    updated_at: now,
  };

  const updatedJob = mapRowToJob(updatedRow);

  logger.warn(
    `[gpu-scheduler] Job ${jobId} failed (attempt ${nextRetryCount}/${existing.max_retries}) -> status=${nextStatus}`,
    { errorMessage, dlqReason },
  );

  return {
    status: nextStatus,
    retryCount: nextRetryCount,
    maxRetries: existing.max_retries,
    shouldDlq: isDlq,
    job: updatedJob,
  };
}
