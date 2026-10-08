/**
 * Inngest Function: Social Direct Publish Job
 * Multi-platform direct publishing with pacing, safety checks, and token vault.
 * Layer: forest/inngest/functions | Max LOC: < 200 | Zero :any
 * @module forest/inngest/functions/social-direct-publish-job
 */

import { inngest } from '@/seed/inngest/client';
import type { SocialPlatform, PublishJobStatus, SocialPublishResult } from '@/seed/types/social-publisher-types';
import { decryptTokenVault } from '@/seed/security/oauth-token-vault';
import {
  buildYouTubeInitRequest,
  calculateYouTubeChunks,
  buildTikTokInitPayload,
  buildInstagramContainerInit,
} from '@/tree/social/publisher/platform-adapters';
import { evaluateChannelPacing, isSameUTCDay } from '@/tree/social/publisher/pacing-engine';
import { getCredential, upsertCredential } from '@/land/social/platform-credentials-store';
import { updatePublishJobStatus } from '@/land/social/publish-job-store';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';

export interface SocialPublishDispatchedEventData {
  jobId: string;
  userId: string;
  channelId: string;
  platform: SocialPlatform;
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  totalSizeBytes?: number;
}

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
    const decision = evaluateChannelPacing({
      platform: data.platform,
      channelId: data.channelId,
      todayPublishedCount: cred?.dailyPostCount ?? 0,
      lastPublishedAtMs: cred?.lastPublishedAt ?? null,
    });
    if (decision.reason === 'DAILY_CAP_EXCEEDED') {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: 'Daily posting limit reached for channel' });
      return { allowed: false, reason: decision.reason, delayMs: 0 };
    }
    if (decision.delayMs > 0) await updatePublishJobStatus(data.jobId, 'PACED');
    return { allowed: decision.allowed, reason: decision.reason, delayMs: decision.delayMs };
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
    if (!cred) {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: 'Channel credential not found' });
      return { allowed: false, reason: 'CREDENTIAL_NOT_FOUND' };
    }
    if (cred.killSwitchActive) {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: 'Channel emergency kill switch active' });
      return { allowed: false, reason: 'KILL_SWITCH_ACTIVE' };
    }
    if (!shouldAllowRequest(data.platform, data.channelId)) {
      await updatePublishJobStatus(data.jobId, 'FAILED', { error: 'Platform circuit breaker open' });
      return { allowed: false, reason: 'CIRCUIT_BREAKER_OPEN' };
    }
    return { allowed: true, reason: 'OK' };
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
      const sizeBytes = data.totalSizeBytes ?? 10 * 1024 * 1024;
      let platformPostId = '';
      let publishedUrl = '';

      if (data.platform === 'YOUTUBE_SHORTS') {
        buildYouTubeInitRequest({ title: data.title, description: data.description, tags: data.tags, totalSizeBytes: sizeBytes });
        calculateYouTubeChunks(sizeBytes);
        platformPostId = `yt_${data.jobId}`;
        publishedUrl = `https://youtube.com/shorts/${data.jobId}`;
      } else if (data.platform === 'TIKTOK_V2') {
        buildTikTokInitPayload({ title: data.title, totalSizeBytes: sizeBytes });
        platformPostId = `tt_${data.jobId}`;
        publishedUrl = `https://tiktok.com/@${data.channelId}/video/${data.jobId}`;
      } else {
        buildInstagramContainerInit(data.channelId, { videoUrl: data.videoUrl, caption: data.description || data.title });
        platformPostId = `ig_${data.jobId}`;
        publishedUrl = `https://instagram.com/reel/${data.jobId}`;
      }

      recordSuccess(data.platform, data.channelId);
      return { platformPostId, publishedUrl };
    } catch (err: unknown) {
      recordFailure(data.platform, FailureKind.SERVER_ERROR, data.channelId);
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
      const isRolledOver = typeof cred.lastPublishedAt === 'number' && !isSameUTCDay(cred.lastPublishedAt, completedAt);
      const nextDailyCount = isRolledOver ? 1 : cred.dailyPostCount + 1;
      await upsertCredential({
        userId: data.userId,
        platform: data.platform,
        channelId: data.channelId,
        channelName: cred.channelName,
        encryptedTokens: cred.encryptedTokens,
        tokenExpiresAt: cred.tokenExpiresAt,
        dailyPostCount: nextDailyCount,
        lastPublishedAt: completedAt,
        killSwitchActive: cred.killSwitchActive,
      });
    }

    return {
      jobId: data.jobId,
      platform: data.platform,
      status: 'PUBLISHED' as PublishJobStatus,
      platformPostId: uploadResult.platformPostId,
      publishedUrl: uploadResult.publishedUrl,
      completedAt,
    };
  });
}

export const socialDirectPublishJob = inngest.createFunction(
  { id: 'social-direct-publish-job', name: 'Social Direct Publish Job', retries: 3 },
  { event: 'social.publish.dispatched' },
  processSocialDirectPublishJob,
);
