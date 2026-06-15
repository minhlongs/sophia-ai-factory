'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  createRepurposeJob,
  getRepurposeJob,
  listRepurposeJobs,
  getRepurposeClips,
} from '@/seed/db/repositories/repurpose-jobs-repo';
import { inngest } from '@/forest/inngest/client';
import type { RepurposeJob, RepurposeClip } from '@/seed/db/repositories/repurpose-jobs-repo';

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createRepurposeAction(
  sourceVideoId: string,
): Promise<ActionResult<{ jobId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  try {
    const job = await createRepurposeJob({ userId: user.id, sourceVideoId });

    await inngest.send({
      name: 'repurpose/analyze.requested',
      data: {
        jobId: job.id,
        userId: user.id,
        videoUrl: '',
        transcript: [],
      },
    });

    return { success: true, data: { jobId: job.id } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function getRepurposeJobAction(
  jobId: string,
): Promise<ActionResult<{ job: RepurposeJob; clips: RepurposeClip[] }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const job = await getRepurposeJob(jobId);
  if (!job || job.user_id !== user.id) return { success: false, error: 'Job not found' };

  const clips = await getRepurposeClips(jobId);
  return { success: true, data: { job, clips } };
}

export async function listRepurposeJobsAction(): Promise<ActionResult<RepurposeJob[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const jobs = await listRepurposeJobs(user.id);
  return { success: true, data: jobs };
}

export async function approveClipsAction(
  jobId: string,
  clipIds: string[],
): Promise<ActionResult<{ approved: number }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const job = await getRepurposeJob(jobId);
  if (!job || job.user_id !== user.id) return { success: false, error: 'Job not found' };

  const clips = await getRepurposeClips(jobId);
  const approved = clips.filter((c) => clipIds.includes(c.id));

  for (const clip of approved) {
    await inngest.send({
      name: 'repurpose/clip.generate',
      data: {
        clipId: clip.id,
        jobId,
        videoUrl: '',
        startMs: clip.start_ms,
        endMs: clip.end_ms,
        userId: user.id,
      },
    });
  }

  return { success: true, data: { approved: approved.length } };
}
