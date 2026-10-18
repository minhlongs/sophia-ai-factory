import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import {
  type VideoRow,
  type TemplateRow,
  ScheduleWhatsAppError,
} from './types';
import { newJobId } from './template-resolver';

export async function verifyWhatsAppSchedulePrerequisites(
  db: D1Database,
  userId: string,
  videoId: string,
): Promise<Result<void, ScheduleWhatsAppError>> {
  const video = await db
    .prepare('SELECT id, user_id FROM videos WHERE id = ?1 LIMIT 1')
    .bind(videoId)
    .first<VideoRow>();
  if (!video) {
    return failure(new ScheduleWhatsAppError('VIDEO_NOT_FOUND', `video ${videoId} not found`));
  }
  if (video.user_id !== userId) {
    return failure(new ScheduleWhatsAppError('FORBIDDEN', 'video belongs to a different user'));
  }

  return success(undefined);
}

export async function verifyWhatsAppTemplateOwnership(
  db: D1Database,
  userId: string,
  templateId: number,
): Promise<Result<void, ScheduleWhatsAppError>> {
  const cred = await db
    .prepare(
      `SELECT id FROM whatsapp_templates
       WHERE id = ?1 AND user_id = ?2 LIMIT 1`,
    )
    .bind(templateId, userId)
    .first<TemplateRow>();
  if (!cred) {
    return failure(
      new ScheduleWhatsAppError(
        'NO_WHATSAPP_CREDENTIALS',
        'WhatsApp credential not found for this user',
      ),
    );
  }
  return success(undefined);
}

export async function insertWhatsAppPublishingJob(params: {
  db: D1Database;
  userId: string;
  videoId: string;
  templateId: number;
  target: string;
}): Promise<Result<string, ScheduleWhatsAppError>> {
  const { db, userId, videoId, templateId, target } = params;
  const jobId = newJobId();
  const now = Math.floor(Date.now() / 1000);
  const recipient = `wa:${target.replace(/^\+/, '')}`;

  try {
    await db
      .prepare(
        `INSERT INTO publishing_jobs (
           id, tenant_id, video_id, channel_id, provider, status,
           caption, hashtags_json, product_link, scheduled_at,
           retry_count, created_at
         ) VALUES (?, ?, ?, ?, 'whatsapp', 'scheduled', ?, NULL, NULL, ?, 0, ?)`,
      )
      .bind(jobId, userId, videoId, recipient, templateId, now, now)
      .run();
    return success(jobId);
  } catch (err) {
    const error = toError(err);
    logger.error('[WhatsAppPublish] D1 insert failed', error, {
      userId,
      videoId,
      templateId,
    });
    return failure(new ScheduleWhatsAppError('INSERT_FAILED', error.message));
  }
}
