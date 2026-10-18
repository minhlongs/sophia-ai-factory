'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import {
  ScheduleWhatsAppSchema,
  ApproveWhatsAppSchema,
  type ScheduleWhatsAppInput,
  type ApproveWhatsAppInput,
  type ScheduleWhatsAppResult,
  type ApproveWhatsAppResult,
  ScheduleWhatsAppError,
  ApproveWhatsAppError,
} from './types';
import {
  checkApprovalStatus,
  setApprovalStatus,
} from './template-resolver';
import {
  verifyWhatsAppSchedulePrerequisites,
  verifyWhatsAppTemplateOwnership,
  insertWhatsAppPublishingJob,
} from './whatsapp-job-persistence';

/**
 * Server Action: Schedule a WhatsApp publish job.
 */
export async function scheduleWhatsApp(
  input: ScheduleWhatsAppInput,
): Promise<Result<ScheduleWhatsAppResult>> {
  const parsed = ScheduleWhatsAppSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      new ScheduleWhatsAppError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input'),
    );
  }
  const { videoId, templateId, target, variables: _variables } = parsed.data;

  const user = await getCurrentUser();
  if (!user) {
    return failure(new ScheduleWhatsAppError('UNAUTHENTICATED', 'Authentication required'));
  }

  const db = await getD1();
  if (!db) return failure(new ScheduleWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  const videoCheck = await verifyWhatsAppSchedulePrerequisites(db, user.id, videoId);
  if (!videoCheck.ok) return failure(videoCheck.error);

  const approval = await checkApprovalStatus(user.id);
  if (!approval.ok) return failure(approval.error);
  if (!approval.value) {
    return success({
      jobId: '',
      status: 'pending_approval',
      error: 'User must approve WhatsApp sends before first publish',
    });
  }

  const credCheck = await verifyWhatsAppTemplateOwnership(db, user.id, templateId);
  if (!credCheck.ok) return failure(credCheck.error);

  const insertResult = await insertWhatsAppPublishingJob({
    db,
    userId: user.id,
    videoId,
    templateId,
    target,
  });
  if (!insertResult.ok) return failure(insertResult.error);

  logger.info('[WhatsAppPublish] Job scheduled', {
    jobId: insertResult.value,
    userId: user.id,
    videoId,
    templateId,
    target,
  });

  return success({ jobId: insertResult.value, status: 'scheduled' });
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
