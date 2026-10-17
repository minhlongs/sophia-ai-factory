/**
 * @file job-enqueuer.ts
 * @description Logic for enqueuing compute jobs into growth_v11_compute_jobs.
 * @layer forest
 */

import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ComputeJobRecord,
  EnqueueComputeJobInput,
  SchedulerError,
} from './types';
import { getDatabase } from './time-window-resolver';
import {
  buildComputeJobEnqueuePlan,
  type ComputeJobEnqueuePlan,
} from './job-enqueue-plan';

export { buildComputeJobEnqueuePlan, type ComputeJobEnqueuePlan };

const ENQUEUE_JOB_SQL = `
  INSERT INTO growth_v11_compute_jobs (
    id, job_id, video_id, user_tier, velocity_score, priority,
    target_model_tier, earliest_execution_sec, latest_execution_sec,
    is_off_peak, estimated_cost_usd, estimated_savings_usd, discount_ratio,
    status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(job_id) DO UPDATE SET
    velocity_score = excluded.velocity_score,
    priority = excluded.priority,
    target_model_tier = excluded.target_model_tier,
    status = excluded.status,
    updated_at = excluded.updated_at
`;

/**
 * Enqueue a compute job into growth_v11_compute_jobs.
 * Dispatches high-velocity renders immediately (PENDING),
 * and queues low-priority renders for off-peak execution (QUEUED).
 */
export async function enqueueComputeJob(
  db: D1Database,
  input: EnqueueComputeJobInput,
): Promise<Result<ComputeJobRecord, SchedulerError>> {
  if (!input.jobId || !input.videoId) {
    return failure({
      code: 'INVALID_INPUT',
      message: 'Both jobId and videoId are required to enqueue compute job.',
    });
  }

  const activeDb = getDatabase(db);
  const { record, isOffPeakFlag } = buildComputeJobEnqueuePlan(input);

  try {
    await activeDb
      .prepare(ENQUEUE_JOB_SQL)
      .bind(
        record.id,
        record.jobId,
        record.videoId,
        record.userTier,
        record.velocityScore,
        record.priority,
        record.targetModelTier,
        record.earliestExecutionSec,
        record.latestExecutionSec,
        isOffPeakFlag,
        record.estimatedCostUsd,
        record.estimatedSavingsUsd,
        record.discountRatio,
        record.status,
        record.createdAt,
        record.updatedAt,
      )
      .run();

    logger.info('[OpportunisticScheduler] Job enqueued', {
      jobId: input.jobId,
      status: record.status,
      priority: record.priority,
      isOffPeak: isOffPeakFlag,
    });

    return success(record);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[OpportunisticScheduler] Failed to enqueue job', {
      jobId: input.jobId,
      error: errorMsg,
    });
    return failure({
      code: 'DB_INSERT_FAILED',
      message: `Failed to insert job into growth_v11_compute_jobs: ${errorMsg}`,
    });
  }
}
