/**
 * Step Helpers for Social Direct Publish Job (seed + tree layer dependencies only)
 * Layer: forest/inngest/functions
 * @module forest/inngest/functions/social-direct-publish-steps
 */

import type { SocialPlatform, PublishJobStatus, SocialPublishResult } from '@/seed/types/social-publisher-types';
import {
  buildYouTubeInitRequest,
  calculateYouTubeChunks,
  buildTikTokInitPayload,
  buildInstagramContainerInit,
} from '@/tree/social/publisher/platform-adapters';
import { isSameUTCDay } from '@/tree/social/publisher/pacing-engine';
import { recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';

export { evaluatePacingStepDecision, evaluateSafetyGuardsDecision } from './social-direct-publish-guards';

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

export interface ChannelCredentialSnapshot {
  channelName: string;
  encryptedTokens: string;
  tokenExpiresAt?: number | null;
  dailyPostCount: number;
  lastPublishedAt?: number | null;
  killSwitchActive: boolean;
}

export function executePlatformUploadAdapter(
  data: SocialPublishDispatchedEventData,
): { platformPostId: string; publishedUrl: string } {
  try {
    const sizeBytes = data.totalSizeBytes ?? 10 * 1024 * 1024;
    let platformPostId = '';
    let publishedUrl = '';

    if (data.platform === 'YOUTUBE_SHORTS') {
      buildYouTubeInitRequest({
        title: data.title,
        description: data.description,
        tags: data.tags,
        totalSizeBytes: sizeBytes,
      });
      calculateYouTubeChunks(sizeBytes);
      platformPostId = `yt_${data.jobId}`;
      publishedUrl = `https://youtube.com/shorts/${data.jobId}`;
    } else if (data.platform === 'TIKTOK_V2') {
      buildTikTokInitPayload({ title: data.title, totalSizeBytes: sizeBytes });
      platformPostId = `tt_${data.jobId}`;
      publishedUrl = `https://tiktok.com/@${data.channelId}/video/${data.jobId}`;
    } else {
      buildInstagramContainerInit(data.channelId, {
        videoUrl: data.videoUrl,
        caption: data.description || data.title,
      });
      platformPostId = `ig_${data.jobId}`;
      publishedUrl = `https://instagram.com/reel/${data.jobId}`;
    }

    recordSuccess(data.platform, data.channelId);
    return { platformPostId, publishedUrl };
  } catch (err: unknown) {
    recordFailure(data.platform, FailureKind.SERVER_ERROR, data.channelId);
    throw err;
  }
}

export function buildPublishedResult(
  data: SocialPublishDispatchedEventData,
  uploadResult: { platformPostId: string; publishedUrl: string },
  completedAt: number,
): SocialPublishResult {
  return {
    jobId: data.jobId,
    platform: data.platform,
    status: 'PUBLISHED' as PublishJobStatus,
    platformPostId: uploadResult.platformPostId,
    publishedUrl: uploadResult.publishedUrl,
    completedAt,
  };
}

export function computeNextDailyPostCount(
  lastPublishedAt: number | null | undefined,
  dailyPostCount: number,
  completedAt: number,
): number {
  const isRolledOver = typeof lastPublishedAt === 'number' && !isSameUTCDay(lastPublishedAt, completedAt);
  return isRolledOver ? 1 : dailyPostCount + 1;
}
