/**
 * Step Helpers for Social Direct Publish Job (seed + tree layer dependencies only)
 * Layer: forest/inngest/functions
 * @module forest/inngest/functions/social-direct-publish-steps
 */

import type { SocialPlatform, PublishJobStatus, SocialPublishResult } from '@/seed/types/social-publisher-types';
import { isSameUTCDay } from '@/tree/social/publisher/pacing-engine';
import { executePlatformUpload } from '@/tree/social/publisher/upload-executor';

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
 * `PUBLISHED` and `FAILED` count permanently — a terminal job is done, whether
 * it succeeded or a provider rejected it.
 *
 * `UPLOADING` counts only while it is fresh. A worker can die between writing
 * `UPLOADING` and writing a terminal status (deploy, timeout, crash), which
 * would otherwise strand the job: every later delivery would skip it and it
 * would never complete nor appear as retryable. After the grace window the
 * status is treated as stale and the delivery is allowed to proceed.
 */
export const ALREADY_UPLOADED_STATUSES = new Set<PublishJobStatus>(['UPLOADING', 'PUBLISHED']);

/** How long a stranded UPLOADING row stays authoritative before a retry may resume it. */
export const UPLOADING_STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * True when the job must not reach the provider on this delivery because a
 * previous delivery already did. `FAILED` is deliberately absent: a provider
 * 401 or an unreadable response is not evidence that media reached the
 * provider, and treating it as such would cancel the function's own retries
 * plus any operator re-dispatch. A stale `UPLOADING` returns false so a
 * worker killed mid-upload leaves a resumable job rather than a dead one.
 */
export function isPublishJobAlreadyAttempted(
  job: { status: PublishJobStatus; updatedAt?: number | null } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!job || !ALREADY_UPLOADED_STATUSES.has(job.status)) return false;
  if (job.status !== 'UPLOADING') return true;
  const updatedAt = typeof job.updatedAt === 'number' ? job.updatedAt : null;
  if (updatedAt === null) return false;
  return now - updatedAt < UPLOADING_STALE_AFTER_MS;
}

/**
 * Uploads the media to the platform and returns the provider-confirmed post id
 * and URL. There is no fabricated-URL path: if the provider does not yield a
 * real id, this throws and the caller marks the job FAILED.
 *
 * The decrypted access token is an explicit argument, never a field on the
 * event data. An Inngest event payload is durable, retried, and readable in
 * the Inngest dashboard, so a plaintext provider token must not travel in it —
 * it is decrypted fresh in the orchestrator's vault step on every delivery.
 */
export async function executePlatformUploadAdapter(
  data: SocialPublishDispatchedEventData,
  accessToken: string,
): Promise<{ platformPostId: string; publishedUrl: string }> {
  // No try/catch wrapper: executePlatformUpload already records a classified
  // failure with the breaker before rethrowing. Catching here only to rethrow
  // would be dead code; the caller's step writes FAILED and rethrows itself.
  return executePlatformUpload({
    platform: data.platform,
    accessToken,
    videoUrl: data.videoUrl,
    jobId: data.jobId,
    channelId: data.channelId,
    title: data.title,
    description: data.description,
    tags: data.tags,
    totalSizeBytes: data.totalSizeBytes,
  });
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
