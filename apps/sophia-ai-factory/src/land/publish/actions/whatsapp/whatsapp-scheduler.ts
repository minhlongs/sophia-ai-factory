'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import {
  ScheduleWhatsAppSchema,
  ApproveWhatsAppSchema,
  type ScheduleWhatsAppInput,
  type ApproveWhatsAppInput,
  type ScheduleWhatsAppResult,
  type ApproveWhatsAppResult,
  type VideoRow,
  type TemplateRow,
  ScheduleWhatsAppError,
  ApproveWhatsAppError,
} from './types';
import {
  newJobId,
  checkApprovalStatus,
  setApprovalStatus,
} from './template-resolver';

/**
 * Server Action: Schedule a WhatsApp publish job.
 */
export async function scheduleWhatsApp(
  input: ScheduleWhatsAppInput,
): Promise<Result<ScheduleWhatsAppResult>> {
  // 1. Validate input
  const parsed = ScheduleWhatsAppSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      new ScheduleWhatsAppError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input'),
    );
  }
  const { videoId, templateId, target, variables: _variables } = parsed.data;

  // 2. Auth
  const user = await getCurrentUser();
  if (!user) {
    return failure(new ScheduleWhatsAppError('UNAUTHENTICATED', 'Authentication required'));
  }

  const db = await getD1();
  if (!db) return failure(new ScheduleWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  // 3. Verify video ownership
  const video = await db
    .prepare('SELECT id, user_id FROM videos WHERE id = ?1 LIMIT 1')
    .bind(videoId)
    .first<VideoRow>();
  if (!video) {
    return failure(new ScheduleWhatsAppError('VIDEO_NOT_FOUND', `video ${videoId} not found`));
  }
  if (video.user_id !== user.id) {
    return failure(new ScheduleWhatsAppError('FORBIDDEN', 'video belongs to a different user'));
  }

  // 4. Approval gate
  const approval = await checkApprovalStatus(user.id);
  if (!approval.ok) return failure(approval.error);
  if (!approval.value) {
    return success({
      jobId: '',
      status: 'pending_approval',
      error: 'User must approve WhatsApp sends before first publish',
    });
  }

  // 5. Verify WhatsApp credentials exist for template
  const cred = await db
    .prepare(
      `SELECT id FROM whatsapp_templates
       WHERE id = ?1 AND user_id = ?2 LIMIT 1`,
    )
    .bind(templateId, user.id)
    .first<TemplateRow>();
  if (!cred) {
    return failure(
      new ScheduleWhatsAppError(
        'NO_WHATSAPP_CREDENTIALS',
        'WhatsApp credential not found for this user',
      ),
    );
  }

  // 6. Insert publishing_jobs
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
      .bind(jobId, user.id, videoId, recipient, templateId, now, now)
      .run();
  } catch (err) {
    const error = toError(err);
    logger.error('[WhatsAppPublish] D1 insert failed', error, {
      userId: user.id,
      videoId,
      templateId,
    });
    return failure(new ScheduleWhatsAppError('INSERT_FAILED', error.message));
  }

  logger.info('[WhatsAppPublish] Job scheduled', {
    jobId,
    userId: user.id,
    videoId,
    templateId,
    target,
  });

  return success({ jobId, status: 'scheduled' });
}

/**
 * Server Action: Approve WhatsApp outbound sends for the current user.
 */
export async function approveWhatsApp(
  _input: ApproveWhatsAppInput = {},
): Promise<Result<ApproveWhatsAppResult>> {
  const parsed = ApproveWhatsAppSchema.safeParse(_input);
  if (!parsed.success) {
    return failure(
      new ApproveWhatsAppError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input'),
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return failure(new ApproveWhatsAppError('UNAUTHENTICATED', 'Authentication required'));
  }

  const db = await getD1();
  if (!db) return failure(new ApproveWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  const approval = await checkApprovalStatus(user.id);
  if (!approval.ok) return failure(approval.error);
  if (approval.value) {
    return success({ approved: true });
  }

  const result = await setApprovalStatus(user.id);
  if (!result.ok) return failure(result.error);

  return success({ approved: true });
}
