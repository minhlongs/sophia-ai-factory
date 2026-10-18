/**
 * Forest orchestration helper: insert a publishing_jobs row + emit publish.scheduled event.
 *
 * Architecture note (2026-05-09, updated Wave 20 Phase 05):
 *   publishing_jobs.video_id column stores videos.id (renamed from the misleading
 *   video_job_id in Wave 20 Phase 05 — see migration 0101). publishExecute resolves
 *   the canonical R2 URL via getCanonicalVideoUrl(videoId, userId) from
 *   `src/lib/video/get-canonical-video-url.ts`.
 *
 * @module forest/publishing/schedule-publish
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { resolvePublishCooldown } from './schedule-publish-cooldown';

export interface SchedulePublishInput {
  /**
   * D1 publishing_channels.id (NOT provider string).
   * For Telegram: telegram_paired_chats.chat_id used as surrogate
   * (D1/SQLite has no FK enforcement so this is safe).
   */
  channelId: string;
  /** videos.id or video_jobs.id depending on pipeline */
  videoId: string;
  /** tenant_id = user.id convention */
  tenantId: string;
  userId: string;
  caption?: string;
  scheduledAt?: number; // Unix epoch seconds; defaults to now
  /**
   * Provider string stored in publishing_jobs.provider (migration 0099).
   * Required for Telegram dispatch (publishExecute bypasses publishing_channels
   * lookup when provider='telegram'). Defaults to '' for legacy callers.
   */
  provider?: string;
}

export interface SchedulePublishResult {
  jobId: string;
  /** Present when the job was deferred past the originally requested scheduledAt. */
  deferredUntil?: number;
  /** Reason for deferral (cooldown | burst); undefined if not deferred. */
  deferReason?: 'cooldown' | 'burst';
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
  const { channelId, videoId, tenantId, userId, caption, scheduledAt, provider = '' } = input;
  const jobId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const requested = scheduledAt ?? now;

  const { scheduled, deferredUntil, deferReason } = await resolvePublishCooldown({
    tenantId,
    channelId,
    provider,
    requested,
    now,
  });

  try {
    await db
      .prepare(
        `INSERT INTO publishing_jobs
           (id, tenant_id, video_id, channel_id, provider, status, caption,
            hashtags_json, product_link, scheduled_at, retry_count, created_at)
         VALUES (?, ?, ?, ?, ?, 'scheduled', ?, NULL, NULL, ?, 0, ?)`,
      )
      .bind(jobId, tenantId, videoId, channelId, provider, caption ?? null, scheduled, now)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[schedulePublish] D1 insert failed', err instanceof Error ? err : new Error(msg), { jobId, channelId, videoId });
    throw new Error(`[schedulePublish] Insert failed: ${msg}`);
  }

  await inngest.send({
    name: 'publish.scheduled',
    data: { jobId, tenantId, userId },
  });

  logger.info('[schedulePublish] Job inserted and event emitted', {
    jobId, channelId, videoId,
    deferred: deferredUntil !== undefined,
    deferredUntil,
    deferReason,
  });
  return { jobId, deferredUntil, deferReason };
}
