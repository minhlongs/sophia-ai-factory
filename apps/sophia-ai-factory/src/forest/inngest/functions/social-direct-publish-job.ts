/**
 * Inngest Function: Social Direct Publish Job
 * Multi-platform direct publishing with pacing, safety checks, and token vault.
 * Layer: forest/inngest/functions | Max LOC: < 200 | Zero :any
 * @module forest/inngest/functions/social-direct-publish-job
 */

import { inngest } from '@/seed/inngest/client';
import type { SocialPublishResult } from '@/seed/types/social-publisher-types';
import { decryptTokenVault } from '@/seed/security/oauth-token-vault';
import { isAffiliateKillSwitchActive } from '@/tree/affiliate/kill-switch/kill-switch-store';
import { getCredential, upsertCredential } from '@/land/social/platform-credentials-store';
import { getPublishJob, updatePublishJobStatus } from '@/land/social/publish-job-store';
import {
  evaluatePacingStepDecision,
  evaluateSafetyGuardsDecision,
  executePlatformUploadAdapter,
  buildPublishedResult,
  computeNextDailyPostCount,
  isPublishJobAlreadyAttempted,
  type SocialPublishDispatchedEventData,
} from './social-direct-publish-steps';

export { type SocialPublishDispatchedEventData };

export interface InngestStepContext {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  sleep: (id: string, duration: string | number) => Promise<void>;
}

export async function processSocialDirectPublishJob({
  event,
  step,
}: {
  event: { data: unknown };
  step: InngestStepContext;
}): Promise<SocialPublishResult | { status: string; jobId: string; reason: string }> {
  const data = event.data as SocialPublishDispatchedEventData;

  // Step 1: Pacing check + duplicate-delivery guard
  const pacingResult = await step.run('evaluate-pacing', async () => {
    // A re-delivered event (Inngest retry, or a duplicate send) must never
    // reach the provider twice. `UPLOADING` is written immediately before the
    // provider call, so its presence means a previous delivery already tried.
    const existing = await getPublishJob(data.jobId);
    if (isPublishJobAlreadyAttempted(existing)) {
      return { allowed: false, reason: 'ALREADY_UPLOADED', delayMs: 0 };
    }

    const cred = await getCredential(data.userId, data.platform, data.channelId);
    const decision = evaluatePacingStepDecision(data, cred);
    if (decision.reason === 'DAILY_CAP_EXCEEDED') {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: 'Daily posting limit reached for channel' });
      return decision;
    }
    if (decision.delayMs > 0) await updatePublishJobStatus(data.jobId, 'PACED');
    return decision;
  });

  if (!pacingResult.allowed && pacingResult.reason === 'ALREADY_UPLOADED') {
    return { status: 'SKIPPED_ALREADY_UPLOADED', jobId: data.jobId, reason: pacingResult.reason };
  }
  if (!pacingResult.allowed && pacingResult.reason === 'DAILY_CAP_EXCEEDED') {
    return { status: 'HALTED_DAILY_CAP', jobId: data.jobId, reason: pacingResult.reason };
  }
  if (pacingResult.delayMs > 0) {
    await step.sleep('pacing-stagger-delay', `${Math.max(1, Math.ceil(pacingResult.delayMs / 1000))}s`);
  }

  // Step 2: Emergency kill-switch and circuit-breaker check
  const safetyCheck = await step.run('check-safety-guards', async () => {
    const effectiveTenant = data.tenantId ?? data.userId;
    if (await isAffiliateKillSwitchActive(effectiveTenant)) {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: 'Workspace emergency kill switch active' });
      return { allowed: false, reason: 'KILL_SWITCH_ACTIVE' };
    }
    const cred = await getCredential(data.userId, data.platform, data.channelId);
    const guard = evaluateSafetyGuardsDecision(data, cred);
    if (!guard.allowed && guard.errorMessage) {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: guard.errorMessage });
    }
    return { allowed: guard.allowed, reason: guard.reason };
  });

  if (!safetyCheck.allowed) return { status: 'ABORTED_SAFETY', jobId: data.jobId, reason: safetyCheck.reason };

  // Step 3: Vault decryption of access token
  const vaultToken = await step.run('decrypt-vault-token', async () => {
    const cred = await getCredential(data.userId, data.platform, data.channelId);
    if (!cred) throw new Error('Missing channel credential during token retrieval');
    const tokens = await decryptTokenVault(cred.encryptedTokens, {
      userId: data.userId,
      platform: data.platform,
      channelId: data.channelId,
    });
    await updatePublishJobStatus(data.jobId, 'UPLOADING');
    return { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
  });

  // Step 4: Dispatch upload chunk / container
  const uploadResult = await step.run('dispatch-platform-upload', async () => {
    try {
      return await executePlatformUploadAdapter({ ...data, accessToken: vaultToken.accessToken });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: msg });
      throw err;
    }
  });

  // Step 5: Update publish job status
  return await step.run('reconcile-publish-status', async () => {
    const completedAt = Date.now();
    await updatePublishJobStatus(data.jobId, 'PUBLISHED', {
      platformPostId: uploadResult.platformPostId,
      publishedUrl: uploadResult.publishedUrl,
      completedAt,
    });

    const cred = await getCredential(data.userId, data.platform, data.channelId);
    if (cred) {
      await upsertCredential({
        userId: data.userId,
        platform: data.platform,
        channelId: data.channelId,
        channelName: cred.channelName,
        encryptedTokens: cred.encryptedTokens,
        tokenExpiresAt: cred.tokenExpiresAt,
        dailyPostCount: computeNextDailyPostCount(cred.lastPublishedAt, cred.dailyPostCount, completedAt),
        lastPublishedAt: completedAt,
        killSwitchActive: cred.killSwitchActive,
      });
    }

    return buildPublishedResult(data, uploadResult, completedAt);
  });
}

export const socialDirectPublishJob = inngest.createFunction(
  { id: 'social-direct-publish-job', name: 'Social Direct Publish Job', retries: 3 },
  { event: 'social.publish.dispatched' },
  processSocialDirectPublishJob,
);
