/**
 * Pure publish workflow — no Inngest dependencies.
 * Main entry point: executePublishWorkflow().
 * Sub-modules: publish-types, publish-url-utils, publish-claim,
 *              publish-telegram-flow, publish-upload, publish-finalize.
 * @module land/video/publishing/execute
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { isAffiliateKillSwitchActive } from '@/tree/affiliate/kill-switch/kill-switch-store';
import type { ExecutePublishWorkflowArgs, ClaimResult } from './publish-types';
import { findJobById, checkAndMarkMaxRetries, atomicClaimJob } from './publish-claim';
import { handleTelegramFlow } from './publish-telegram-flow';
import { processStandardProvider } from './publish-standard-processor';

// Re-export public API for external consumers
export type { Step, ExecutePublishWorkflowArgs, ClaimResult } from './publish-types';
export { sanitizeError, assertSafeVideoUrl, resolveVideoUrlOrFail, buildPostUrl } from './publish-url-utils';
export { buildPublisher, uploadToProvider, pollStatusUntilFinal } from './publish-upload';
export { processStandardProvider } from './publish-standard-processor';

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

  // Defer execution if job is scheduled for a future audience slot
  if (job.scheduled_at && job.scheduled_at > now) {
    const delaySec = job.scheduled_at - now;
    logger.info('[publishExecute] Deferring execution until scheduled slot', {
      jobId,
      scheduledAt: job.scheduled_at,
      delaySec,
    });
    await step.sleep(`wait-for-slot-${jobId}`, `${delaySec}s`);
  }

  // Re-evaluate workspace & platform-wide emergency kill switch immediately before claim/upload
  const effectiveTenant = tenantId || job.tenant_id || userId;
  if (await isAffiliateKillSwitchActive(effectiveTenant)) {
    logger.warn('[publishExecute] Aborted scheduled publish due to active kill switch', {
      jobId,
      tenantId: effectiveTenant,
    });
    await db
      .from('publishing_jobs')
      .update({ status: 'failed', error_message: 'Aborted by emergency kill switch' })
      .eq('id', jobId);
    return {
      skipped: false,
      jobId,
      status: 'failed',
      externalPostId: '',
      provider: '',
      error: 'KILL_SWITCH_ACTIVE',
    };
  }

  const alreadyClaimed = args.alreadyClaimed === true;
  let isClaimed = alreadyClaimed;
  if (!alreadyClaimed) {
    const { claimed } = await atomicClaimJob(db, jobId);
    isClaimed = claimed;
  }

  if (!isClaimed) {
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
