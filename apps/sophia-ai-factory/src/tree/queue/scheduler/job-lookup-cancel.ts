/**
 * Fair-Share GPU Scheduler: Job Lookup and Cancellation
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/scheduler/job-lookup-cancel
 */

import type { D1Database } from '@/seed/db/client';
import type {
  VideoRenderJob,
  VideoRenderRow,
} from '@/seed/types/video-render-queue';
import { mapRowToJob } from '@/seed/types/video-render-queue';

/**
 * Cancel a job if it has not yet reached a terminal state
 */
export async function cancelJob(
  db: D1Database,
  jobId: string,
  orgId?: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  let query = `UPDATE video_render_jobs
               SET status = 'failed',
                   error_message = 'Cancelled by user or operator',
                   leased_by = NULL,
                   leased_until = NULL,
                   updated_at = ?
               WHERE id = ? AND status IN ('queued', 'leased')`;
  const params: unknown[] = [now, jobId];

  if (orgId) {
    query += ` AND org_id = ?`;
    params.push(orgId);
  }

  const res = await db.prepare(query).bind(...params).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Get job by ID with optional tenant isolation check
 */
export async function getJobById(
  db: D1Database,
  jobId: string,
  orgId?: string,
): Promise<VideoRenderJob | null> {
  let query = `SELECT * FROM video_render_jobs WHERE id = ?`;
  const params: unknown[] = [jobId];

  if (orgId) {
    query += ` AND org_id = ?`;
    params.push(orgId);
  }

  const row = await db.prepare(query).bind(...params).first<VideoRenderRow>();
  if (!row) return null;
  return mapRowToJob(row);
}
