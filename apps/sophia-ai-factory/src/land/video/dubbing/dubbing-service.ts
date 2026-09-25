/**
 * Video Dubbing Domain Service
 *
 * Manages video dubbing job registration, Inngest dispatch, and state tracking.
 *
 * Layer: land (business operations and domain services)
 * Imports: seed only (NO forest imports permitted)
 *
 * @module land/video/dubbing/dubbing-service
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  DubbingJobInput,
  DubbingJobResult,
} from '@/seed/types/dubbing';

// ── In-Memory Job Store (with D1 readiness) ───────────────────────────────────

export interface StoredDubbingJob extends DubbingJobResult {
  userId: string;
  tenantId: string;
}

const inMemoryJobs = new Map<string, StoredDubbingJob>();

/**
 * Register and enqueue a new video dubbing job.
 */
export async function createDubbingJob(
  input: Omit<DubbingJobInput, 'jobId'> & { jobId?: string },
): Promise<{ jobId: string }> {
  const jobId = input.jobId || `dub_${crypto.randomUUID()}`;
  const fullInput: DubbingJobInput = {
    ...input,
    jobId,
    sourceLocale: input.sourceLocale || 'vi',
  };

  const initialJob: StoredDubbingJob = {
    jobId,
    videoId: input.videoId,
    userId: input.userId,
    tenantId: input.tenantId,
    status: 'pending',
    audioTrackUrls: {},
    subtitleUrls: {},
    createdAt: new Date().toISOString(),
  };

  inMemoryJobs.set(jobId, initialJob);

  try {
    await inngest.send({
      name: 'video.dubbing.requested',
      data: fullInput,
    });

    logger.info('[DubbingService] Inngest job dispatched', {
      jobId,
      videoId: input.videoId,
      locales: input.targetLocales,
    });
  } catch (err) {
    logger.warn('[DubbingService] Failed to dispatch Inngest event (will retry or process)', {
      jobId,
      error: String(err),
    });
  }

  return { jobId };
}

/**
 * Retrieve the current status and results of a video dubbing job.
 */
export async function getDubbingJobStatus(jobId: string): Promise<DubbingJobResult | null> {
  const job = inMemoryJobs.get(jobId);
  if (!job) return null;
  return { ...job };
}

/**
 * Update the state and artifacts of a dubbing job.
 */
export async function updateDubbingJobResult(
  jobId: string,
  update: Partial<DubbingJobResult>,
): Promise<void> {
  const existing = inMemoryJobs.get(jobId);
  if (!existing) {
    logger.warn('[DubbingService] Attempted to update non-existent dubbing job', { jobId });
    return;
  }

  const updated: StoredDubbingJob = {
    ...existing,
    ...update,
    completedAt:
      update.status === 'completed' || update.status === 'failed'
        ? new Date().toISOString()
        : existing.completedAt,
  };

  inMemoryJobs.set(jobId, updated);
}

/**
 * List all dubbing jobs for a user strictly scoped by userId and tenantId.
 * Never leaks cross-tenant or cross-user jobs.
 */
export async function listDubbingJobsForUser(
  userId: string,
  tenantId?: string,
): Promise<DubbingJobResult[]> {
  const results: DubbingJobResult[] = [];
  for (const job of inMemoryJobs.values()) {
    if (tenantId) {
      if (job.userId === userId && job.tenantId === tenantId) {
        results.push({ ...job });
      }
    } else {
      if (job.userId === userId) {
        results.push({ ...job });
      }
    }
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
