/**
 * Fair-Share GPU Scheduler: Job Registration and Retrieval
 *
 * Implements job ID generation, job enqueuing, lookup, and cancellation.
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/scheduler/job-lifecycle
 */

import type { D1Database } from '@/seed/db/client';
import type {
  VideoRenderJob,
  EnqueueJobInput,
} from '@/seed/types/video-render-queue';
import {
  getPriorityScoreForTier,
  getLaneForTier,
} from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';
import { cancelJob, getJobById } from './job-lookup-cancel';

export { cancelJob, getJobById };

/**
 * Generate a random UUID-like identifier without external dependencies
 */
export function generateJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `vrj_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `vrj_${timestamp}${randomPart}`;
}

/**
 * Enqueue a new video render job into the batch queue
 */
export async function enqueueJob(
  db: D1Database,
  input: EnqueueJobInput,
): Promise<VideoRenderJob> {
  const id = input.id || generateJobId();
  const now = Math.floor(Date.now() / 1000);
  const tier = input.tier || 'basic';
  const lane = input.lane || getLaneForTier(tier);
  const priorityScore =
    input.priorityScore !== undefined ? input.priorityScore : getPriorityScoreForTier(tier);
  const payloadStr =
    typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload);
  const maxRetries = input.maxRetries !== undefined ? input.maxRetries : 3;

  await db
    .prepare(
      `INSERT INTO video_render_jobs (
        id, org_id, subaccount_id, lane, priority_score, status,
        tier, payload, retry_count, max_retries, provider,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, 0, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.orgId,
      input.subaccountId || null,
      lane,
      priorityScore,
      tier,
      payloadStr,
      maxRetries,
      input.preferredProvider || null,
      now,
      now,
    )
    .run();

  const createdJob: VideoRenderJob = {
    id,
    orgId: input.orgId,
    subaccountId: input.subaccountId || null,
    lane,
    priorityScore,
    status: 'queued',
    tier,
    payload: input.payload,
    retryCount: 0,
    maxRetries,
    provider: input.preferredProvider || null,
    createdAt: now,
    updatedAt: now,
  };

  logger.info(`[gpu-scheduler] Enqueued job ${id} in lane=${lane} score=${priorityScore} tier=${tier}`);
  return createdJob;
}
