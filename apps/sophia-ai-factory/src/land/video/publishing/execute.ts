/**
 * Pure publish workflow — no Inngest dependencies.
 * Main entry point: executePublishWorkflow().
 * Sub-modules: publish-types, publish-url-utils, publish-claim,
 *              publish-telegram-flow, publish-upload, publish-finalize.
 * @module land/video/publishing/execute
 */

import { createServerClient } from '@/seed/db/client';
import {
  VideoNotFoundError,
  VideoUnauthorizedError,
} from '@/land/video/storage/get-canonical-video-url';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel, PublishingJob } from '@/seed/types';

import type { Step, ExecutePublishWorkflowArgs, ClaimResult } from './publish-types';
import { findJobById, checkAndMarkMaxRetries, atomicClaimJob } from './publish-claim';
import { handleTelegramFlow } from './publish-telegram-flow';
import { fetchChannelForJob, ensureFreshToken, uploadToProvider, pollStatusUntilFinal } from './publish-upload';
import { resolveVideoUrlOrFail, assertSafeVideoUrl } from './publish-url-utils';
import { finalizePublishResult } from './publish-finalize';

// Re-export public API for external consumers
export type { Step, ExecutePublishWorkflowArgs, ClaimResult } from './publish-types';
export { sanitizeError, assertSafeVideoUrl, resolveVideoUrlOrFail, buildPostUrl } from './publish-url-utils';
export { buildPublisher, uploadToProvider, pollStatusUntilFinal } from './publish-upload';

async function processStandardProvider(args: {
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  job: PublishingJob;
  tenantId: string;
  userId: string;
  step: Step;
  now: number;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number) => Promise<void>;
  refreshToken?: (channel: PublishingChannel) => Promise<number>;
}): Promise<ClaimResult> {
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
    // finalStatus === 'failed'
    return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
  }
}

export async function executePublishWorkflow(args: ExecutePublishWorkflowArgs): Promise<ClaimResult> {
  const { jobId, tenantId, userId, step, scheduleRetry, refreshToken } = args;
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  const job = await findJobById(db, jobId);
  if (!job) {
    logger.warn('[publishExecute] Job not found', { jobId });
    return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '', error: 'Job not found' };
  }

  const maxRetriesExceeded = await checkAndMarkMaxRetries(db, jobId, job);
  if (maxRetriesExceeded) {
    return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
  }

  const { claimed } = await atomicClaimJob(db, jobId);
  if (!claimed) {
    logger.info('[publishExecute] Already claimed by another worker', { jobId, status: job.status });
    return { skipped: true, jobId, status: job.status as string, externalPostId: '', provider: '' };
  }

  const jobProvider = job.provider ?? '';
  if (jobProvider === 'telegram') {
    const telegramResult = await handleTelegramFlow({ db, job, jobId, tenantId, step, eventId: args.eventId });
    return telegramResult;
  }

  return await processStandardProvider({
    db, jobId, job, tenantId, userId, step, now, scheduleRetry, refreshToken,
  });
}
