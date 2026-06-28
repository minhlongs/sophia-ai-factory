/**
 * Algorithm: schedule a video for auto-publish to a connected channel
 * (YouTube today; other platforms wire in here when their adapters land).
 *
 * Delivers the homepage promise "YouTube Auto-Publishing — Schedule and
 * publish videos to YouTube on cron" by turning what was a UI-only flow
 * into a one-call algorithm REST/Telegram/OpenClaw users can invoke.
 *
 * The algorithm:
 *   1. Verifies the video belongs to the caller (RBAC)
 *   2. Verifies the publishing channel belongs to the caller (RBAC)
 *   3. Inserts a row into publishing_jobs with status='scheduled'
 *   4. Returns {jobId, scheduledAt} — the existing publisher cron picks
 *      the row up and performs the upload via the customer's OAuth token
 *
 * Doctrine: customer brings their YouTube OAuth via the Setup Wizard;
 * operator stores no third-party tokens for the platform to work.
 *
 * @module land/publish/schedule-video-publish
 */
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface SchedulePublishInput {
  userId: string;
  videoId: string;
  channelId: string;
  scheduledAt: number;     // unix seconds
  caption?: string;
  hashtags?: string[];
  productLink?: string;
}

export interface SchedulePublishResult {
  jobId: string;
  scheduledAt: number;
  status: 'scheduled';
}

export class PublishConfigurationError extends Error {
  code: 'VIDEO_NOT_FOUND' | 'CHANNEL_NOT_FOUND' | 'FORBIDDEN' | 'SCHEDULED_IN_PAST' | 'INVALID_INPUT';
  constructor(
    code: 'VIDEO_NOT_FOUND' | 'CHANNEL_NOT_FOUND' | 'FORBIDDEN' | 'SCHEDULED_IN_PAST' | 'INVALID_INPUT',
    message: string,
  ) {
    super(message);
    this.name = 'PublishConfigurationError';
    this.code = code;
  }
}

const MIN_LEAD_TIME_SEC = 0; // allow immediate scheduling for cron pickup

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

function newJobId(): string {
  // RFC 4122 v4-ish (16 random bytes hex). Cheap, no D1 dependency.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function schedulePublish(
  input: SchedulePublishInput,
): Promise<SchedulePublishResult> {
  if (!input.videoId || !input.channelId) {
    throw new PublishConfigurationError('INVALID_INPUT', 'videoId and channelId are required');
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (input.scheduledAt < nowSec - MIN_LEAD_TIME_SEC) {
    throw new PublishConfigurationError(
      'SCHEDULED_IN_PAST',
      `scheduledAt ${input.scheduledAt} is before now ${nowSec}`,
    );
  }

  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  // RBAC: video must belong to caller
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

  // RBAC: channel must belong to caller. publishing_channels has both
  // user_id and tenant_id columns depending on which migration created it;
  // we accept ownership via either path so the algorithm works against
  // older D1 snapshots.
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
        channel.provider || 'youtube',
      )
      .run();
  } catch (err) {
    logger.error('[schedule-video-publish] insert failed', toError(err), {
      userId: input.userId,
      videoId: input.videoId,
      channelId: input.channelId,
    });
    throw err;
  }

  return { jobId, scheduledAt: input.scheduledAt, status: 'scheduled' };
}
