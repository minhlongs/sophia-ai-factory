import type { D1Database } from '@/seed/db/client';
import type { VideoRenderJob, VideoRenderRow } from '@/seed/types/video-render-queue';
import { mapRowToJob } from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: delayMs = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs)
 */
export function calculateExponentialBackoff(
  retryCount: number,
  baseDelayMs = 1000,
  maxDelayMs = 60000,
  withJitter = false,
): number {
  const safeRetries = Math.max(0, retryCount);
  const exponential = baseDelayMs * Math.pow(2, safeRetries);
  const capped = Math.min(exponential, maxDelayMs);

  if (!withJitter) {
    return Math.floor(capped);
  }

  // 10% additive random jitter
  const jitter = Math.floor(Math.random() * 0.1 * capped);
  return Math.floor(capped + jitter);
}

/**
 * Determine if a job has exceeded its retry budget and should be routed to DLQ
 */
export function shouldRouteToDlq(retryCount: number, maxRetries = 3): boolean {
  return retryCount >= maxRetries;
}

/**
 * Explicitly route a job into the Dead-Letter Queue (DLQ)
 */
export async function routeJobToDlq(
  db: D1Database,
  jobId: string,
  dlqReason = 'MAX_RETRIES_EXCEEDED',
  errorMessage?: string,
): Promise<VideoRenderJob> {
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .prepare(`SELECT * FROM video_render_jobs WHERE id = ?`)
    .bind(jobId)
    .first<VideoRenderRow>();

  if (!existing) {
    throw new Error(`Video render job ${jobId} not found`);
  }

  const finalError = errorMessage || existing.error_message || 'Job exceeded max retries';

  await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = 'dlq',
           dlq_reason = ?,
           error_message = ?,
           leased_by = NULL,
           leased_until = NULL,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(dlqReason, finalError, now, jobId)
    .run();

  const updatedRow: VideoRenderRow = {
    ...existing,
    status: 'dlq',
    dlq_reason: dlqReason,
    error_message: finalError,
    leased_by: null,
    leased_until: null,
    updated_at: now,
  };

  const updatedJob = mapRowToJob(updatedRow);

  logger.warn(`[dlq-router] Job ${jobId} transitioned to status=dlq (reason=${dlqReason})`);
  return updatedJob;
}
