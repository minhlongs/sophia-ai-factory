/**
 * Publishing execution standard provider processor
 * @module land/video/publishing/publish-standard-processor
 */

import { createServerClient } from '@/seed/db/client';
import type { PublishingChannel, PublishingJob, ProvenanceInput } from '@/seed/types';
import type { Step, ClaimResult } from './publish-types';
import { fetchChannelForJob, ensureFreshToken, uploadToProvider, pollStatusUntilFinal } from './publish-upload';
import { assertSafeVideoUrl } from './publish-url-utils';
import { finalizePublishResult } from './publish-finalize';

export interface ProcessStandardProviderArgs {
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  job: PublishingJob;
  tenantId: string;
  userId: string;
  step: Step;
  now: number;
  /** Resolved and verified before the approval gate, so the media is known. */
  videoUrl: string;
  provenance?: ProvenanceInput;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number, delayMs?: number) => Promise<void>;
  refreshToken?: (channel: PublishingChannel) => Promise<number>;
}

export async function processStandardProvider(args: ProcessStandardProviderArgs): Promise<ClaimResult> {
  const { db, jobId, job, tenantId, userId, step, now, scheduleRetry, videoUrl, provenance, refreshToken } = args;

  const channel = await fetchChannelForJob(db, job, tenantId);
  const accessToken = await ensureFreshToken(db, channel, now, refreshToken);

  assertSafeVideoUrl(videoUrl);

  const retryCount = job.retry_count + 1;
  const { externalPostId, shouldRetry, error } = await uploadToProvider({
    channel, accessToken, videoUrl, job, db, jobId, retryCount, scheduleRetry, tenantId, userId, provenance,
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
