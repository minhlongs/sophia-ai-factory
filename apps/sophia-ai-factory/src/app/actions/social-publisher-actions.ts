'use server';

/**
 * Server Actions: Social Direct Publisher Cockpit
 * Provides authenticated dispatch, draft transition, and kill switch controls.
 * Layer: app/actions | File size: < 140 LOC | Zero :any.
 * @module app/actions/social-publisher-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  listUserDraftJobs,
  transitionDraftToPending,
  type StoredPublishJob,
} from '@/land/social/publish-job-store';
import { setChannelKillSwitch } from '@/land/social/platform-credentials-store';
import { revalidatePath } from 'next/cache';
import {
  dispatchToSelectedPlatforms,
  sendSocialPublishDispatchedEvent,
  type PublishActionResult,
  type PublishDispatchInput,
} from './social-publisher-helpers';

export type { PublishDispatchInput, PublishActionResult };

export async function dispatchSocialPublishAction(
  input: PublishDispatchInput,
): Promise<PublishActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: 'Vui lòng đăng nhập / Unauthorized' };
  }

  if (!input.title.trim()) {
    return { ok: false, message: 'Tiêu đề không được để trống / Title is required' };
  }
  if (!input.platforms || input.platforms.length === 0) {
    return { ok: false, message: 'Chọn ít nhất 1 nền tảng / Select at least 1 platform' };
  }

  const { createdJobIds, errors } = await dispatchToSelectedPlatforms(user.id, input);

  revalidatePath('/dashboard/social-publisher');

  if (createdJobIds.length === 0) {
    return { ok: false, message: errors.join('; ') || 'Không thể tạo tác vụ xuất bản' };
  }

  const successMsg = `Đã lên lịch thành công ${createdJobIds.length} tác vụ xuất bản`;
  return {
    ok: true,
    message: errors.length > 0 ? `${successMsg}. Lưu ý: ${errors.join('; ')}` : successMsg,
    jobIds: createdJobIds,
  };
}

export async function toggleChannelKillSwitchAction(
  channelId: string,
  current: boolean,
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const ok = await setChannelKillSwitch(user.id, channelId, !current);
  if (ok) {
    revalidatePath('/dashboard/social-publisher');
  }
  return ok;
}

export async function approveDraftAction(jobId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  try {
    const job = await transitionDraftToPending(jobId, user.id);
    await sendSocialPublishDispatchedEvent(job, user.id);
    revalidatePath('/dashboard/social-publisher');
    return true;
  } catch {
    return false;
  }
}

export async function listUserDraftsAction(): Promise<StoredPublishJob[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return await listUserDraftJobs(user.id, 20);
}
