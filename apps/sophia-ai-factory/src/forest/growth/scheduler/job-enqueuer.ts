/**
 * @file job-enqueuer.ts
 * @description Logic for enqueuing compute jobs into growth_v11_compute_jobs.
 * @layer forest
 */

import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  isOffPeakUtcHour,
  evaluateComputeArbitrage,
} from '@/tree/growth-v11/compute-arbitrage';
import type {
  SophiaTier,
  ComputePriority,
  ComputeModelTier,
} from '@/seed/types/growth-triad-v11';
import type {
  ComputeJobRecord,
  ComputeJobStatus,
  EnqueueComputeJobInput,
  SchedulerError,
} from './types';
import {
  calculateNextOffPeakStartSec,
  getDatabase,
} from './time-window-resolver';

/**
 * Enqueue a compute job into growth_v11_compute_jobs.
 * Dispatches high-velocity renders immediately (PENDING),
 * and queues low-priority renders for off-peak execution (QUEUED).
 */
export async function enqueueComputeJob(
  db: D1Database,
  input: EnqueueComputeJobInput
): Promise<Result<ComputeJobRecord, SchedulerError>> {
  if (!input.jobId || !input.videoId) {
    return failure({
      code: 'INVALID_INPUT',
      message: 'Both jobId and videoId are required to enqueue compute job.',
    });
  }

  const activeDb = getDatabase(db);
  const now = input.currentDate ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const currentHourUtc = now.getUTCHours();
  const offPeak = isOffPeakUtcHour(currentHourUtc);

  const velocity = input.velocityScore ?? 50;
  const isHighVelocity = velocity >= 75;

  let priority: ComputePriority = input.priority ?? (isHighVelocity ? 'IMMEDIATE_PREMIUM' : 'OFF_PEAK_ECONOMIC');
  let status: ComputeJobStatus;
  let isOffPeakFlag: number;
  let earliestExecutionSec: number;

  if (priority === 'IMMEDIATE_PREMIUM' || isHighVelocity) {
    priority = 'IMMEDIATE_PREMIUM';
    status = 'PENDING';
    isOffPeakFlag = 0;
    earliestExecutionSec = nowSec;
  } else if (priority === 'OFF_PEAK_ECONOMIC') {
    isOffPeakFlag = 1;
    if (offPeak) {
      status = 'PENDING';
      earliestExecutionSec = nowSec;
    } else {
      status = 'QUEUED';
      earliestExecutionSec = calculateNextOffPeakStartSec(now);
    }
  } else {
    status = 'PENDING';
    isOffPeakFlag = offPeak ? 1 : 0;
    earliestExecutionSec = nowSec;
  }

  const durationSeconds = input.durationSeconds ?? 60;
  const arbitrageSpec = evaluateComputeArbitrage(
    {
      durationSeconds,
      isHighVelocity,
      allowDeferred: priority === 'OFF_PEAK_ECONOMIC',
    },
    currentHourUtc
  );

  const targetModelTier: ComputeModelTier =
    input.targetModelTier ??
    (isHighVelocity ? 'PHOTOREAL_EXPENSIVE' : offPeak ? 'STANDARD_BALANCED' : 'ECONOMY_DEGRADED');

  const discountRatio = offPeak || priority === 'OFF_PEAK_ECONOMIC' ? 0.42 : 0.0;
  const latestExecutionSec = earliestExecutionSec + 86400;
  const userTier: SophiaTier = input.userTier ?? 'BASIC';
  const rowId = `v11_job_${nowSec}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    const query = `
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

    await activeDb
      .prepare(query)
      .bind(
        rowId,
        input.jobId,
        input.videoId,
        userTier,
        velocity,
        priority,
        targetModelTier,
        earliestExecutionSec,
        latestExecutionSec,
        isOffPeakFlag,
        arbitrageSpec.estimatedCostUsd,
        arbitrageSpec.savingsUsd,
        discountRatio,
        status,
        nowSec,
        nowSec
      )
      .run();

    const record: ComputeJobRecord = {
      id: rowId,
      jobId: input.jobId,
      videoId: input.videoId,
      userTier,
      velocityScore: velocity,
      priority,
      targetModelTier,
      earliestExecutionSec,
      latestExecutionSec,
      isOffPeak: Boolean(isOffPeakFlag),
      estimatedCostUsd: arbitrageSpec.estimatedCostUsd,
      estimatedSavingsUsd: arbitrageSpec.savingsUsd,
      discountRatio,
      status,
      createdAt: nowSec,
      updatedAt: nowSec,
    };

    logger.info('[OpportunisticScheduler] Job enqueued', {
      jobId: input.jobId,
      status,
      priority,
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
