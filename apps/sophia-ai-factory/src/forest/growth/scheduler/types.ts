/**
 * @file types.ts
 * @description Type definitions for opportunistic compute job scheduler.
 * @layer forest
 */

import type {
  SophiaTier,
  ComputePriority,
  ComputeModelTier,
} from '@/seed/types/growth-triad-v11';

export type ComputeJobStatus =
  | 'QUEUED'
  | 'PENDING'
  | 'LEASED'
  | 'DISPATCHED'
  | 'COMPLETED'
  | 'FAILED';

export interface ComputeJobRow {
  id: string;
  job_id: string;
  video_id: string;
  user_tier: string;
  velocity_score: number;
  priority: string;
  target_model_tier: string;
  earliest_execution_sec: number;
  latest_execution_sec: number;
  is_off_peak: number;
  estimated_cost_usd: number;
  estimated_savings_usd: number;
  discount_ratio: number;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface ComputeJobRecord {
  id: string;
  jobId: string;
  videoId: string;
  userTier: SophiaTier;
  velocityScore: number;
  priority: ComputePriority;
  targetModelTier: ComputeModelTier;
  earliestExecutionSec: number;
  latestExecutionSec: number;
  isOffPeak: boolean;
  estimatedCostUsd: number;
  estimatedSavingsUsd: number;
  discountRatio: number;
  status: ComputeJobStatus;
  createdAt: number;
  updatedAt: number;
}

export interface EnqueueComputeJobInput {
  jobId: string;
  videoId: string;
  userTier?: SophiaTier;
  velocityScore?: number;
  priority?: ComputePriority;
  targetModelTier?: ComputeModelTier;
  durationSeconds?: number;
  currentDate?: Date;
}

export interface LeaseOptions {
  limit?: number;
  leaseDurationSec?: number;
  currentDate?: Date;
  allowedPriorities?: ComputePriority[];
}

export interface QueueCoordinationResult {
  isOffPeak: boolean;
  currentHourUtc: number;
  promotedCount: number;
  leasedCount: number;
  dispatchedCount: number;
  heldInQueueCount: number;
  leasedJobs: ComputeJobRecord[];
  summary: string;
}

export interface SchedulerError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
