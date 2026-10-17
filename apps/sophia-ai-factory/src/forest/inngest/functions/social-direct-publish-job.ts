/**
 * Inngest Function: Social Direct Publish Job
 * Multi-platform direct publishing with pacing, safety checks, and token vault.
 * Layer: forest/inngest/functions | Max LOC: < 200 | Zero :any
 * @module forest/inngest/functions/social-direct-publish-job
 */

import { inngest } from '@/seed/inngest/client';
import type { SocialPublishResult } from '@/seed/types/social-publisher-types';
import { decryptTokenVault } from '@/seed/security/oauth-token-vault';
import { getCredential, upsertCredential } from '@/land/social/platform-credentials-store';
import { updatePublishJobStatus } from '@/land/social/publish-job-store';
import {
  evaluatePacingStepDecision,
  evaluateSafetyGuardsDecision,
  executePlatformUploadAdapter,
  buildPublishedResult,
  computeNextDailyPostCount,
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

  // Step 1: Pacing check
  const pacingResult = await step.run('evaluate-pacing', async () => {
    const cred = await getCredential(data.userId, data.platform, data.channelId);
    const decision = evaluatePacingStepDecision(data, cred);
    if (decision.reason === 'DAILY_CAP_EXCEEDED') {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: 'Daily posting limit reached for channel' });
      return decision;
    }
    if (decision.delayMs > 0) await updatePublishJobStatus(data.jobId, 'PACED');
    return decision;
  });

  if (!pacingResult.allowed && pacingResult.reason === 'DAILY_CAP_EXCEEDED') {
    return { status: 'HALTED_DAILY_CAP', jobId: data.jobId, reason: pacingResult.reason };
  }
  if (pacingResult.delayMs > 0) {
    await step.sleep('pacing-stagger-delay', `${Math.max(1, Math.ceil(pacingResult.delayMs / 1000))}s`);
  }

  // Step 2: Emergency kill-switch and circuit-breaker check
  const safetyCheck = await step.run('check-safety-guards', async () => {
    const cred = await getCredential(data.userId, data.platform, data.channelId);
    const guard = evaluateSafetyGuardsDecision(data, cred);
    if (!guard.allowed && guard.errorMessage) {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: guard.errorMessage });
    }
    return { allowed: guard.allowed, reason: guard.reason };
  });

  if (!safetyCheck.allowed) return { status: 'ABORTED_SAFETY', jobId: data.jobId, reason: safetyCheck.reason };

  // Step 3: Vault decryption of access token
  await step.run('decrypt-vault-token', async () => {
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
      return executePlatformUploadAdapter(data);
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
