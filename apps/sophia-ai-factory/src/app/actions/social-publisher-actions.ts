'use server';

/**
 * Server Actions: Social Direct Publisher Cockpit
 * Provides authenticated dispatch, draft transition, and kill switch controls.
 * Layer: app/actions | File size: < 180 LOC | Zero :any.
 * @module app/actions/social-publisher-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import {
  createPublishJob,
  listUserDraftJobs,
  transitionDraftToPending,
  type StoredPublishJob,
} from '@/land/social/publish-job-store';
import {
  listUserCredentials,
  setChannelKillSwitch,
} from '@/land/social/platform-credentials-store';
import { evaluateChannelPacing } from '@/tree/social/publisher/pacing-engine';
import { revalidatePath } from 'next/cache';

export interface PublishDispatchInput {
  title: string;
  caption: string;
  videoUrl: string;
  platforms: SocialPlatform[];
  useJitter: boolean;
}

export interface PublishActionResult {
  ok: boolean;
  message: string;
  jobIds?: string[];
}

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

  const credentials = await listUserCredentials(user.id);
  const createdJobIds: string[] = [];
  const errors: string[] = [];

  for (const platform of input.platforms) {
    const cred = credentials.find((c) => c.platform === platform);
    if (!cred) {
      errors.push(`${platform}: Kênh chưa liên kết / Channel not connected`);
      continue;
    }
    if (cred.killSwitchActive) {
      errors.push(`${platform}: Kênh đang bật Kill Switch bảo vệ / Kill switch is active`);
      continue;
    }

    const jitterOffsetMs = input.useJitter
      ? evaluateChannelPacing({
          platform,
          channelId: cred.channelId,
          todayPublishedCount: cred.dailyPostCount,
          lastPublishedAtMs: cred.lastPublishedAt ?? null,
        }).delayMs
      : 0;

    const scheduledFor = jitterOffsetMs > 0 ? Date.now() + jitterOffsetMs : undefined;

    try {
      const job = await createPublishJob({
        userId: user.id,
        channelId: cred.channelId,
        platform,
        videoUrl: input.videoUrl,
        title: input.title,
        description: input.caption,
        status: 'PENDING',
        scheduledFor,
      });

      createdJobIds.push(job.id);

      await inngest.send({
        name: 'social.publish.dispatched',
        data: {
          jobId: job.id,
          userId: user.id,
          channelId: cred.channelId,
          platform,
          videoUrl: input.videoUrl,
          title: input.title,
          description: input.caption,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${platform}: ${msg}`);
    }
  }

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
    await inngest.send({
      name: 'social.publish.dispatched',
      data: {
        jobId: job.id,
        userId: user.id,
        channelId: job.channelId,
        platform: job.platform,
        videoUrl: job.videoUrl,
        title: job.title,
        description: job.description,
      },
    });
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
