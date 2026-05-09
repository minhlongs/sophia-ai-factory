/**
 * Forest orchestration helper: insert a publishing_jobs row + emit publish.scheduled event.
 *
 * Architecture note (2026-05-09):
 *   publishing_jobs.video_job_id is a FK to the Remotion video_jobs table.
 *   The HeyGen `videos` table is a separate pipeline. When called from the
 *   distribute-route for HeyGen videos, videoId = videos.id is stored in
 *   video_job_id as a loose reference. publishExecute will attempt a
 *   video_jobs lookup (and find nothing) — this is a known cross-pipeline
 *   gap to be resolved in Wave 17 with a proper video abstraction layer.
 *   The UI/API layer (Phase 02) is correct; full execution requires Wave 17.
 *
 * Idempotency: caller passes through; let publishExecute CAS handle
 * duplicate jobs (KISS — no new unique-key migration).
 *
 * @module forest/publishing/schedule-publish
 */

import { randomUUID } from 'crypto';
import { inngest } from '@/forest/inngest/client';
import { logger } from '@/seed/utils/logger-utility';

export interface SchedulePublishInput {
  /** D1 publishing_channels.id (NOT provider string) */
  channelId: string;
  /** videos.id or video_jobs.id depending on pipeline */
  videoId: string;
  /** tenant_id = user.id convention */
  tenantId: string;
  userId: string;
  caption?: string;
  scheduledAt?: number; // Unix epoch seconds; defaults to now
}

export interface SchedulePublishResult {
  jobId: string;
}

/**
 * Insert a publishing_jobs row and emit publish.scheduled Inngest event.
 * Returns the new jobId.
 * Throws on D1 insert failure (caller must handle).
 */
export async function schedulePublish(
  db: D1Database,
  input: SchedulePublishInput,
): Promise<SchedulePublishResult> {
  const { channelId, videoId, tenantId, userId, caption, scheduledAt } = input;
  const jobId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const scheduled = scheduledAt ?? now;

  // Insert publishing_jobs row
  // Columns from 20260503_publishing.sql:
  //   id, tenant_id, video_job_id, channel_id, status, caption,
  //   hashtags_json, product_link, scheduled_at, started_at, finished_at,
  //   retry_count, error, created_at
  const insertResult = await db
    .prepare(
      `INSERT INTO publishing_jobs
         (id, tenant_id, video_job_id, channel_id, status, caption,
          hashtags_json, product_link, scheduled_at, retry_count, created_at)
       VALUES (?, ?, ?, ?, 'scheduled', ?, NULL, NULL, ?, 0, ?)`,
    )
    .bind(jobId, tenantId, videoId, channelId, caption ?? null, scheduled, now)
    .run();

  if (insertResult.error) {
    logger.error('[schedulePublish] D1 insert failed', new Error(insertResult.error), { jobId, channelId, videoId });
    throw new Error(`[schedulePublish] Insert failed: ${insertResult.error}`);
  }

  // Emit Inngest event — matches publish.scheduled schema in inngest client
  await inngest.send({
    name: 'publish.scheduled',
    data: { jobId, tenantId, userId },
  });

  logger.info('[schedulePublish] Job inserted and event emitted', { jobId, channelId, videoId });
  return { jobId };
}
