/**
 * Step Helpers for Social Direct Publish Job (seed + tree layer dependencies only)
 * Layer: forest/inngest/functions
 * @module forest/inngest/functions/social-direct-publish-steps
 */

import type { SocialPlatform, PublishJobStatus, SocialPublishResult } from '@/seed/types/social-publisher-types';
import { isSameUTCDay } from '@/tree/social/publisher/pacing-engine';
import { executePlatformUpload } from '@/tree/social/publisher/upload-executor';
import { recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export { evaluatePacingStepDecision, evaluateSafetyGuardsDecision } from './social-direct-publish-guards';

export interface SocialPublishDispatchedEventData {
  jobId: string;
  userId: string;
  tenantId?: string;
  channelId: string;
  platform: SocialPlatform;
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  totalSizeBytes?: number;
  /** Decrypted channel access token, resolved by the orchestrator's credential step. */
  accessToken: string;
}

export interface ChannelCredentialSnapshot {
  channelName: string;
  encryptedTokens: string;
  tokenExpiresAt?: number | null;
  dailyPostCount: number;
  lastPublishedAt?: number | null;
  killSwitchActive: boolean;
}

/**
 * Statuses that mean the upload has already been attempted by a previous
 * delivery of the same event. Inngest retries a failed function up to
 * `retries: 3`; without this guard a retry that died mid-upload re-sends the
 * same media to the provider and double-posts the channel.
 *
 * `UPLOADING` counts: it is only written immediately before the provider call,
 * so its presence proves a prior delivery reached the provider. `PACED` and
 * `PENDING` do not count — those are pre-upload states the retry may retake.
 */
export const ALREADY_UPLOADED_STATUSES = new Set<PublishJobStatus>(['UPLOADING', 'PUBLISHED', 'FAILED']);

/**
 * True when the job already reached a post-attempt status, meaning a prior
 * delivery reached the provider and this delivery must be a no-op rather than
 * a second post.
 */
export function isPublishJobAlreadyAttempted(
  job: { status: PublishJobStatus } | null | undefined,
): boolean {
  return job ? ALREADY_UPLOADED_STATUSES.has(job.status) : false;
}

/**
 * Uploads the media to the platform and returns the provider-confirmed post id
 * and URL. There is no fabricated-URL path: if the provider does not yield a
 * real id, this throws and the caller marks the job FAILED.
 */
export async function executePlatformUploadAdapter(
  data: SocialPublishDispatchedEventData,
): Promise<{ platformPostId: string; publishedUrl: string }> {
  try {
    return await executePlatformUpload({
      platform: data.platform,
      accessToken: data.accessToken,
      videoUrl: data.videoUrl,
      jobId: data.jobId,
      channelId: data.channelId,
      title: data.title,
      description: data.description,
      tags: data.tags,
      totalSizeBytes: data.totalSizeBytes,
    });
  } catch (err: unknown) {
    recordFailure(data.platform, classifyError(err), data.channelId);
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
