/**
 * Video Publishing Scheduler
 * Layer: land/video/publishing
 */

import { logger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@/seed/db/client';
import {
  type SchedulePublishInput,
  type SchedulePublishResult,
  PublishConfigurationError,
} from './types';
import {
  resolvePublishDb,
  validateVideoAndChannel,
} from './video-scheduler-helpers';

export {
  resolvePublishDb,
  validateVideoAndChannel,
  type VideoRow,
  type ChannelRow,
} from './video-scheduler-helpers';

function newJobId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canonical video publishing scheduling service.
 * Handles RBAC verification, past-date checks, D1 job queuing, and platform attribution.
 */
export async function scheduleVideoPublish(
  input: SchedulePublishInput,
  customDb?: D1Database,
): Promise<SchedulePublishResult> {
  if (!input.videoId || !input.channelId) {
    throw new PublishConfigurationError('INVALID_INPUT', 'videoId and channelId are required');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (input.scheduledAt < nowSec) {
    throw new PublishConfigurationError(
      'SCHEDULED_IN_PAST',
      `scheduledAt ${input.scheduledAt} is before now ${nowSec}`,
    );
  }

  const db = await resolvePublishDb(customDb);
  const effectiveTenantId = input.tenantId ?? input.userId;
  const { channel } = await validateVideoAndChannel(
    db,
    input.videoId,
    input.channelId,
    input.userId,
    effectiveTenantId,
  );

  const jobId = newJobId();
  try {
    await db
      .prepare(
        `INSERT INTO publishing_jobs (
           id, tenant_id, video_id, channel_id, status, caption,
           hashtags_json, product_link, scheduled_at, retry_count,
           created_at, provider
         ) VALUES (?1, ?2, ?3, ?4, 'scheduled', ?5, ?6, ?7, ?8, 0, ?9, ?10)`,
      )
      .bind(
        jobId,
        effectiveTenantId,
        input.videoId,
        input.channelId,
        input.caption ?? null,
        input.hashtags && input.hashtags.length > 0 ? JSON.stringify(input.hashtags) : null,
        input.productLink ?? null,
        input.scheduledAt,
        nowSec,
        input.provider || channel.provider || 'youtube',
      )
      .run();
  } catch (err) {
    logger.error('[VideoPublishingService] scheduleVideoPublish insert failed', {
      userId: input.userId,
      videoId: input.videoId,
      channelId: input.channelId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  return { jobId, scheduledAt: input.scheduledAt, status: 'scheduled' };
}
