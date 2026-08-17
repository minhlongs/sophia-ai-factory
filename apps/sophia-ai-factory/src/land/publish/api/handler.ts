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
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';

export const whatsappPublishSchema = z.object({
  videoId: z.string().min(1, 'videoId is required'),
  target: z.string().regex(/^\+?\d{10,15}$/, 'target must be E.164 phone number'),
  templateId: z.number().int().positive('templateId must be a positive integer'),
});
export type WhatsAppPublishInput = z.infer<typeof whatsappPublishSchema>;

export interface WhatsAppPublishResult {
  jobId: string;
  status: 'scheduled' | 'pending_approval';
  error?: string;
}

type PublishErrorCode =
  | 'UNAUTHENTICATED' | 'VIDEO_NOT_FOUND' | 'FORBIDDEN' | 'NOT_APPROVED'
  | 'NO_WHATSAPP_CREDENTIALS' | 'INSERT_FAILED'
  | 'INVALID_INPUT' | 'D1_UNAVAILABLE';

export class WhatsAppPublishError extends Error {
  code: PublishErrorCode;
  constructor(code: PublishErrorCode, message: string) {
    super(message);
    this.name = 'WhatsAppPublishError';
    this.code = code;
  }
}

interface VideoRow { id: string; user_id: string }
interface ApprovalRow { whatsapp_approved: number }

function newJobId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if the user has approved WhatsApp outbound sends.
 */
export async function checkApprovalStatus(userId: string): Promise<Result<boolean>> {
  const db = getD1();
  if (!db) return failure(new WhatsAppPublishError('D1_UNAVAILABLE', 'D1 not available'));
  const row = await db
    .prepare(
      `SELECT whatsapp_approved FROM whatsapp_templates
       WHERE user_id = ?1 ORDER BY is_default DESC LIMIT 1`,
    )
    .bind(userId)
    .first<ApprovalRow>();
  if (!row) return success(false);
  return success(row.whatsapp_approved === 1);
}

/**
 * Mark the user as having approved WhatsApp outbound sends.
 */
export async function approveWhatsappSend(userId: string): Promise<Result<void>> {
  const db = getD1();
  if (!db) return failure(new WhatsAppPublishError('D1_UNAVAILABLE', 'D1 not available'));
  const result = await db
    .prepare(`UPDATE whatsapp_templates SET whatsapp_approved = 1 WHERE user_id = ?1`)
    .bind(userId)
    .run();
  if ((result.meta?.changes ?? 0) === 0) {
    return failure(
      new WhatsAppPublishError('NO_WHATSAPP_CREDENTIALS', 'No WhatsApp credentials found for this user'),
    );
  }
  logger.info('[WhatsAppPublish] User approved WhatsApp sends', { userId });
  return success(undefined);
}

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
  // Auth
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
  const db = getD1();
  if (!db) return failure(new WhatsAppPublishError('D1_UNAVAILABLE', 'D1 not available'));

  // RBAC: video must belong to caller
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

  // Approval gate: first publish requires explicit approval
  const approval = await checkApprovalStatus(userId);
  if (!approval.ok) return failure(approval.error);
  if (!approval.value) {
    return success({
      jobId: '',
      status: 'pending_approval',
      error: 'User must approve WhatsApp sends before first publish',
    });
  }

  // Verify WhatsApp credentials exist for this template
  const cred = await db
    .prepare(`SELECT id FROM whatsapp_templates WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(templateId, userId)
    .first<{ id: number }>();
  if (!cred) {
    return failure(
      new WhatsAppPublishError('NO_WHATSAPP_CREDENTIALS', 'WhatsApp credential not found for this user'),
    );
  }

  // Insert publishing_jobs (same pattern as schedule-video-publish.ts)
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
