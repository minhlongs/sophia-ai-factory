/**
 * @file job-enqueue-plan.ts
 * @description Pure scheduling plan builder for enqueuing compute jobs.
 * @layer forest
 */

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
} from './types';
import { calculateNextOffPeakStartSec } from './time-window-resolver';

export interface ComputeJobEnqueuePlan {
  record: ComputeJobRecord;
  isOffPeakFlag: number;
}

export function buildComputeJobEnqueuePlan(
  input: EnqueueComputeJobInput,
): ComputeJobEnqueuePlan {
  const now = input.currentDate ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const currentHourUtc = now.getUTCHours();
  const offPeak = isOffPeakUtcHour(currentHourUtc);

  const velocity = input.velocityScore ?? 50;
  const isHighVelocity = velocity >= 75;

  let priority: ComputePriority =
    input.priority ?? (isHighVelocity ? 'IMMEDIATE_PREMIUM' : 'OFF_PEAK_ECONOMIC');
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
    currentHourUtc,
  );

  const targetModelTier: ComputeModelTier =
    input.targetModelTier ??
    (isHighVelocity
      ? 'PHOTOREAL_EXPENSIVE'
      : offPeak
        ? 'STANDARD_BALANCED'
        : 'ECONOMY_DEGRADED');

  const discountRatio = offPeak || priority === 'OFF_PEAK_ECONOMIC' ? 0.42 : 0.0;
  const latestExecutionSec = earliestExecutionSec + 86400;
  const userTier: SophiaTier = input.userTier ?? 'BASIC';
  const rowId = `v11_job_${nowSec}_${Math.random().toString(36).substring(2, 9)}`;

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

  return { record, isOffPeakFlag };
}
