/**
 * Publishing execution standard provider processor
 * @module land/video/publishing/publish-standard-processor
 */

import { createServerClient } from '@/seed/db/client';
import {
  VideoNotFoundError,
  VideoUnauthorizedError,
} from '@/land/video/storage/get-canonical-video-url';
import type { PublishingChannel, PublishingJob } from '@/seed/types';
import type { Step, ClaimResult } from './publish-types';
import { fetchChannelForJob, ensureFreshToken, uploadToProvider, pollStatusUntilFinal } from './publish-upload';
import { resolveVideoUrlOrFail, assertSafeVideoUrl } from './publish-url-utils';
import { finalizePublishResult } from './publish-finalize';

export interface ProcessStandardProviderArgs {
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  job: PublishingJob;
  tenantId: string;
  userId: string;
  step: Step;
  now: number;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number, delayMs?: number) => Promise<void>;
  refreshToken?: (channel: PublishingChannel) => Promise<number>;
}

export async function processStandardProvider(args: ProcessStandardProviderArgs): Promise<ClaimResult> {
  const { db, jobId, job, tenantId, userId, step, now, scheduleRetry, refreshToken } = args;

  const channel = await fetchChannelForJob(db, job, tenantId);
  const accessToken = await ensureFreshToken(db, channel, now, refreshToken);

  let videoUrl: string;
  try {
    videoUrl = await resolveVideoUrlOrFail({ jobId, videoId: job.video_id, userId: tenantId, db, logTag: 'publishExecute' });
  } catch (urlErr) {
    if (urlErr instanceof VideoNotFoundError || urlErr instanceof VideoUnauthorizedError) {
      return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
    }
    throw urlErr;
  }
  assertSafeVideoUrl(videoUrl);

  const retryCount = job.retry_count + 1;
  const { externalPostId, shouldRetry, error } = await uploadToProvider({
    channel, accessToken, videoUrl, job, db, jobId, retryCount, scheduleRetry, tenantId, userId,
  });

  if (shouldRetry) {
    return { skipped: false, jobId, status: 'scheduled', externalPostId: '', provider: '', error };
  }

  if (!externalPostId) {
    return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '', error };
  }

  await db.from('publishing_jobs').update({ status: 'processing' }).eq('id', jobId);

  const finalStatus = await pollStatusUntilFinal({ step, tenantId, provider: channel.provider, externalPostId });

  await finalizePublishResult({
    step, db, jobId, tenantId, provider: channel.provider, externalPostId, finalStatus,
  });

  if (finalStatus === 'live') {
    return { skipped: false, jobId, status: 'live', externalPostId, provider: channel.provider };
  } else {
    return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
  }
}
