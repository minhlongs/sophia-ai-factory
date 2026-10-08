/**
 * Server Actions for Social Direct Publishing Drafts
 * Manages CEO approval queue and 1-click publishing transition.
 * Layer: land (Server Actions) | Max LOC: < 200 | Zero :any
 * @module land/social/actions/social-publisher-draft-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import type { SocialPublishResult } from '@/seed/types/social-publisher-types';
import {
  listUserDraftJobs,
  transitionDraftToPending,
  toSocialPublishResult,
  type StoredPublishJob,
} from '@/land/social/publish-job-store';
import type { SocialPublisherActionResponse } from '@/land/social/actions/social-publisher-actions';
import { toError } from '@/seed/utils/to-error';

export async function listDraftPublishJobsAction(
  limit = 20,
): Promise<SocialPublisherActionResponse<StoredPublishJob[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    const drafts = await listUserDraftJobs(user.id, limit);
    return { success: true, data: drafts };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}

export async function approveDraftPublishJobAction(
  jobId: string,
): Promise<SocialPublisherActionResponse<SocialPublishResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    if (!jobId) return { success: false, error: 'Job ID required', code: 'VALIDATION_ERROR' };

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
        tags: job.tags ?? [],
      },
    });

    return { success: true, data: toSocialPublishResult(job) };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}
