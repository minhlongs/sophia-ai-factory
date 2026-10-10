/**
 * Video Publishing Scheduler
 * Layer: land/video/publishing
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient, getD1, type D1Database } from '@/seed/db/client';
import {
  type SchedulePublishInput,
  type SchedulePublishResult,
  PublishConfigurationError,
} from './types';

function newJobId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface VideoRow {
  id: string;
  user_id: string;
}

interface ChannelRow {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  provider: string;
}

async function resolveDb(customDb?: D1Database): Promise<D1Database> {
  let db: D1Database | null | undefined = customDb;
  if (!db && typeof getD1 === 'function') {
    try {
      db = await getD1();
    } catch {
      // ignore
    }
  }
  if (!db && typeof createServerClient === 'function') {
    try {
      db = createServerClient() as unknown as D1Database;
    } catch {
      // ignore
    }
  }
  if (!db) throw new Error('D1 database binding not available');
  return db;
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

  const db = await resolveDb(customDb);

  const video = await db
    .prepare('SELECT id, user_id FROM videos WHERE id = ?1 LIMIT 1')
    .bind(input.videoId)
    .first<VideoRow>();
  if (!video) {
    throw new PublishConfigurationError('VIDEO_NOT_FOUND', `video ${input.videoId} not found`);
  }
  if (video.user_id !== input.userId) {
    throw new PublishConfigurationError('FORBIDDEN', 'video belongs to a different user');
  }

  const channel = await db
    .prepare(
      'SELECT id, user_id, tenant_id, provider FROM publishing_channels WHERE id = ?1 LIMIT 1',
    )
    .bind(input.channelId)
    .first<ChannelRow>();
  if (!channel) {
    throw new PublishConfigurationError('CHANNEL_NOT_FOUND', `channel ${input.channelId} not found`);
  }
  const owns = channel.user_id === input.userId || channel.tenant_id === input.userId;
  if (!owns) {
    throw new PublishConfigurationError('FORBIDDEN', 'channel belongs to a different user');
  }

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
        input.userId,
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
