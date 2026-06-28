/**
 * Forest orchestration helper: insert a publishing_jobs row + emit publish.scheduled event.
 *
 * Architecture note (2026-05-09, updated Wave 20 Phase 05):
 *   publishing_jobs.video_id column stores videos.id (renamed from the misleading
 *   video_job_id in Wave 20 Phase 05 — see migration 0101). publishExecute resolves
 *   the canonical R2 URL via getCanonicalVideoUrl(videoId, userId) from
 *   `src/lib/video/get-canonical-video-url.ts`.
 *   HeyGen→R2 mirror: complete-video-from-webhook.ts.
 *   FREE100→R2 propagation: video-generate.ts step 7b (Wave 17 Phase 01).
 *
 * Idempotency: caller passes through; let publishExecute CAS handle
 * duplicate jobs (KISS — no new unique-key migration).
 *
 * Cooldown enforcement (Phase 10):
 *   checkCooldown() is called before insert. If violated, scheduledAt is
 *   deferred to deferUntil. The job is always created — never silently dropped.
 *
 * @module forest/publishing/schedule-publish
 */

import { inngest } from '@/forest/inngest/client';
import { checkCooldown } from '@/forest/quota/channel-cooldown';
import { logger } from '@/seed/utils/logger-utility';
import type { ChannelProvider } from '@/forest/publishing/publisher-interface';

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

  // Cooldown + burst check — defer instead of reject (Phase 10)
  let scheduled = requested;
  let deferredUntil: number | undefined;
  let deferReason: 'cooldown' | 'burst' | undefined;

  // Only check cooldown when provider is a known ChannelProvider
  const KNOWN_PROVIDERS: ChannelProvider[] = [
    'tiktok', 'youtube', 'instagram', 'pinterest', 'linkedin', 'zalo',
    'facebook', 'twitter', 'threads', 'reddit', 'bluesky', 'mastodon', 'telegram',
  ];
  const typedProvider = KNOWN_PROVIDERS.includes(provider as ChannelProvider)
    ? (provider as ChannelProvider)
    : null;

  if (typedProvider !== null) {
    try {
      const cooldown = await checkCooldown(tenantId, channelId, typedProvider, now);
      if (!cooldown.allowed && cooldown.deferUntil !== undefined) {
        scheduled = Math.max(requested, cooldown.deferUntil);
        deferredUntil = scheduled;
        deferReason = cooldown.reason;
        logger.info('[schedulePublish] Cooldown deferred', {
          channelId,
          provider,
          reason: cooldown.reason,
          requested,
          deferredUntil: scheduled,
          deferSeconds: cooldown.deferSeconds,
        });
      }
    } catch (cooldownErr) {
      // Cooldown check failure is non-fatal — proceed with original scheduledAt
      logger.warn('[schedulePublish] Cooldown check error (non-fatal)', {
        channelId,
        provider,
        err: cooldownErr instanceof Error ? cooldownErr.message : String(cooldownErr),
      });
    }
  }

  // Insert publishing_jobs row
  // Columns from 20260503_publishing.sql + migration 0099 (provider) + 0101 (video_id rename):
  //   id, tenant_id, video_id, channel_id, provider, status, caption,
  //   hashtags_json, product_link, scheduled_at, started_at, finished_at,
  //   retry_count, error, created_at
  // provider='telegram' enables publishExecute to bypass publishing_channels lookup.
  //
  // NOTE: D1 throws on constraint violations — it does NOT return a .error field on
  // the D1Result object. The try/catch below is the correct D1 contract (Wave 17 Batch 1 C2).
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

  // Emit Inngest event — matches publish.scheduled schema in inngest client
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
