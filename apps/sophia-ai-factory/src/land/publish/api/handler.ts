/**
 * WhatsApp Publish API Handler
 *
 * Schedules a video for WhatsApp Business publish via the existing
 * publishing_jobs pipeline. First publish requires explicit user approval
 * (approval gate). Follows the land/publish/schedule-video-publish pattern
 * with its own D1 operations — no forest imports (4-layer boundary).
 *
 * @module land/publish/api/handler
 */
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import {
  whatsappPublishSchema,
  WhatsAppPublishError,
  newJobId,
  checkApprovalStatus,
  approveWhatsappSend,
  type WhatsAppPublishInput,
  type WhatsAppPublishResult,
} from './whatsapp-publish-approval';

export {
  whatsappPublishSchema,
  WhatsAppPublishError,
  checkApprovalStatus,
  approveWhatsappSend,
  type WhatsAppPublishInput,
  type WhatsAppPublishResult,
};

interface VideoRow { id: string; user_id: string }

/**
 * Schedule a video for WhatsApp Business publish.
 *
 * Flow: validate input, verify auth, verify video ownership, check approval gate,
 * verify WhatsApp credentials, insert publishing_jobs row.
 * Returns a discriminated Result — callers never need try/catch.
 */
export async function scheduleWhatsAppPublish(
  input: WhatsAppPublishInput,
): Promise<Result<WhatsAppPublishResult>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure(new WhatsAppPublishError('UNAUTHENTICATED', 'Authentication required'));
  }
  const userId = user.id;

  const parsed = whatsappPublishSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      new WhatsAppPublishError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input'),
    );
  }
  const { videoId, target, templateId } = parsed.data;
  const db = await getD1();
  if (!db) return failure(new WhatsAppPublishError('D1_UNAVAILABLE', 'D1 not available'));

  const video = await db
    .prepare('SELECT id, user_id FROM videos WHERE id = ?1 LIMIT 1')
    .bind(videoId)
    .first<VideoRow>();
  if (!video) {
    return failure(new WhatsAppPublishError('VIDEO_NOT_FOUND', `video ${videoId} not found`));
  }
  if (video.user_id !== userId) {
    return failure(new WhatsAppPublishError('FORBIDDEN', 'video belongs to a different user'));
  }

  const approval = await checkApprovalStatus(userId);
  if (!approval.ok) return failure(approval.error);
  if (!approval.value) {
    return success({
      jobId: '',
      status: 'pending_approval',
      error: 'User must approve WhatsApp sends before first publish',
    });
  }

  const cred = await db
    .prepare(`SELECT id FROM whatsapp_templates WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(templateId, userId)
    .first<{ id: number }>();
  if (!cred) {
    return failure(
      new WhatsAppPublishError('NO_WHATSAPP_CREDENTIALS', 'WhatsApp credential not found for this user'),
    );
  }

  const jobId = newJobId();
  const now = Math.floor(Date.now() / 1000);
  const recipient = `wa:${target.replace(/^\+/, '')}`;
  try {
    await db
      .prepare(
        `INSERT INTO publishing_jobs
           (id, tenant_id, video_id, channel_id, provider, status,
            caption, hashtags_json, product_link, scheduled_at,
            retry_count, created_at)
         VALUES (?, ?, ?, ?, 'whatsapp', 'scheduled', ?, NULL, NULL, ?, 0, ?)`,
      )
      .bind(jobId, userId, videoId, recipient, templateId, now, now)
      .run();
  } catch (err) {
    const error = toError(err);
    logger.error('[WhatsAppPublish] D1 insert failed', error, { userId, videoId, templateId });
    return failure(new WhatsAppPublishError('INSERT_FAILED', error.message));
  }

  logger.info('[WhatsAppPublish] Job scheduled', { jobId, userId, videoId, templateId, target });
  return success({ jobId, status: 'scheduled' });
}
