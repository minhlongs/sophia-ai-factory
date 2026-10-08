/**
 * @file opportunistic-scheduler.ts
 * @description Coordinates batch queues in D1 SQLite (growth_v11_compute_jobs),
 * inspects UTC off-peak windows (02:00 to 08:00 UTC), leases pending jobs atomically via CAS,
 * dispatches high-velocity renders immediately, and queues low-priority renders for off-peak execution.
 * @layer forest
 */

import type { D1Database, D1Result } from '@cloudflare/workers-types';
import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  isOffPeakUtcHour,
  evaluateComputeArbitrage,
  OFF_PEAK_START_HOUR_UTC,
  OFF_PEAK_END_HOUR_UTC,
} from '@/tree/growth-v11/compute-arbitrage';
import type {
  SophiaTier,
  ComputePriority,
  ComputeModelTier,
} from '@/seed/types/growth-triad-v11';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

// ============================================================================
// Helpers
// ============================================================================

export function isOffPeakNow(date: Date = new Date()): boolean {
  return isOffPeakUtcHour(date.getUTCHours());
}

export function calculateNextOffPeakStartSec(now: Date = new Date()): number {
  const target = new Date(now.getTime());
  target.setUTCMinutes(0, 0, 0);
  const currentHour = target.getUTCHours();

  if (currentHour < OFF_PEAK_START_HOUR_UTC) {
    target.setUTCHours(OFF_PEAK_START_HOUR_UTC);
  } else if (currentHour >= OFF_PEAK_END_HOUR_UTC) {
    target.setUTCDate(target.getUTCDate() + 1);
    target.setUTCHours(OFF_PEAK_START_HOUR_UTC);
  }
  return Math.floor(target.getTime() / 1000);
}

function mapRowToRecord(row: ComputeJobRow): ComputeJobRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    videoId: row.video_id,
    userTier: (row.user_tier as SophiaTier) || 'BASIC',
    velocityScore: row.velocity_score,
    priority: (row.priority as ComputePriority) || 'STANDARD',
    targetModelTier: (row.target_model_tier as ComputeModelTier) || 'STANDARD_BALANCED',
    earliestExecutionSec: row.earliest_execution_sec,
    latestExecutionSec: row.latest_execution_sec,
    isOffPeak: Boolean(row.is_off_peak),
    estimatedCostUsd: row.estimated_cost_usd,
    estimatedSavingsUsd: row.estimated_savings_usd,
    discountRatio: row.discount_ratio,
    status: (row.status as ComputeJobStatus) || 'QUEUED',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDatabase(db?: D1Database): D1Database {
  if (db) return db;
  return createServerClient().unwrap();
}

// ============================================================================
// Scheduler Methods
// ============================================================================

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

/**
 * Leases pending jobs atomically using Compare-And-Swap (CAS) in D1 SQLite.
 * Handles stale leases past leaseDurationSec.
 */
export async function leasePendingJobs(
  db: D1Database,
  options?: LeaseOptions
): Promise<Result<ComputeJobRecord[], SchedulerError>> {
  const activeDb = getDatabase(db);
  const now = options?.currentDate ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const limit = options?.limit ?? 10;
  const leaseDurationSec = options?.leaseDurationSec ?? 300;
  const staleLeaseCutoffSec = nowSec - leaseDurationSec;
  const offPeak = isOffPeakUtcHour(now.getUTCHours());

  try {
    let candidateQuery: string;
    let candidates: ComputeJobRow[] = [];

    if (offPeak) {
      candidateQuery = `
        SELECT * FROM growth_v11_compute_jobs
        WHERE (
          status = 'PENDING'
          OR (status = 'QUEUED' AND is_off_peak = 1 AND earliest_execution_sec <= ?)
          OR (status = 'LEASED' AND updated_at < ?)
        )
        ORDER BY velocity_score DESC, created_at ASC
        LIMIT ?
      `;
      const res = await activeDb
        .prepare(candidateQuery)
        .bind(nowSec, staleLeaseCutoffSec, limit)
        .all<ComputeJobRow>();
      candidates = res.results || [];
    } else {
      candidateQuery = `
        SELECT * FROM growth_v11_compute_jobs
        WHERE (
          (status = 'PENDING' AND priority != 'OFF_PEAK_ECONOMIC')
          OR (status = 'LEASED' AND priority != 'OFF_PEAK_ECONOMIC' AND updated_at < ?)
        )
        ORDER BY velocity_score DESC, created_at ASC
        LIMIT ?
      `;
      const res = await activeDb
        .prepare(candidateQuery)
        .bind(staleLeaseCutoffSec, limit)
        .all<ComputeJobRow>();
      candidates = res.results || [];
    }

    const leasedRecords: ComputeJobRecord[] = [];

    for (const candidate of candidates) {
      const updateQuery = `
        UPDATE growth_v11_compute_jobs
        SET status = 'LEASED', updated_at = ?
        WHERE id = ? AND (
          status IN ('PENDING', 'QUEUED')
          OR (status = 'LEASED' AND updated_at < ?)
        )
      `;

      const updateRes: D1Result = await activeDb
        .prepare(updateQuery)
        .bind(nowSec, candidate.id, staleLeaseCutoffSec)
        .run();

      const changes = updateRes.meta?.changes ?? 0;
      if (changes > 0) {
        candidate.status = 'LEASED';
        candidate.updated_at = nowSec;
        leasedRecords.push(mapRowToRecord(candidate));
      }
    }

    return success(leasedRecords);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[OpportunisticScheduler] Failed to lease pending jobs', { error: errorMsg });
    return failure({
      code: 'LEASE_FAILED',
      message: `Failed to lease pending compute jobs: ${errorMsg}`,
    });
  }
}

/**
 * Coordinates batch queues in D1 SQLite:
 * 1. Inspects current UTC hour.
 * 2. Promotes due off-peak jobs if in window.
 * 3. Atomically leases eligible jobs.
 * 4. Dispatches high-velocity renders immediately.
 */
export async function coordinateBatchQueue(
  db: D1Database,
  options?: { currentDate?: Date; batchLimit?: number }
): Promise<Result<QueueCoordinationResult, SchedulerError>> {
  const activeDb = getDatabase(db);
  const now = options?.currentDate ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const currentHourUtc = now.getUTCHours();
  const isOffPeak = isOffPeakUtcHour(currentHourUtc);
  const limit = options?.batchLimit ?? 20;

  let promotedCount = 0;

  try {
    if (isOffPeak) {
      const promoteQuery = `
        UPDATE growth_v11_compute_jobs
        SET status = 'PENDING', updated_at = ?
        WHERE status = 'QUEUED' AND is_off_peak = 1 AND earliest_execution_sec <= ?
      `;
      const promoteRes = await activeDb.prepare(promoteQuery).bind(nowSec, nowSec).run();
      promotedCount = promoteRes.meta?.changes ?? 0;
      if (promotedCount > 0) {
        logger.info('[OpportunisticScheduler] Promoted off-peak jobs to PENDING', { promotedCount });
      }
    }

    const leaseResult = await leasePendingJobs(activeDb, {
      currentDate: now,
      limit,
    });

    if (!leaseResult.ok) {
      return failure(leaseResult.error);
    }

    const leasedJobs = leaseResult.value;
    let dispatchedCount = 0;

    for (const job of leasedJobs) {
      if (job.priority === 'IMMEDIATE_PREMIUM' || job.velocityScore >= 75 || isOffPeak) {
        await activeDb
          .prepare("UPDATE growth_v11_compute_jobs SET status = 'DISPATCHED', updated_at = ? WHERE job_id = ?")
          .bind(nowSec, job.jobId)
          .run();
        job.status = 'DISPATCHED';
        job.updatedAt = nowSec;
        dispatchedCount++;
      }
    }

    const queuedCountRes = await activeDb
      .prepare("SELECT COUNT(*) as count FROM growth_v11_compute_jobs WHERE status = 'QUEUED'")
      .bind()
      .first<{ count: number }>();
    const heldInQueueCount = queuedCountRes?.count ?? 0;

    const summary = isOffPeak
      ? `Off-peak window [02:00-08:00 UTC] active. Promoted ${promotedCount}, leased ${leasedJobs.length}, dispatched ${dispatchedCount}.`
      : `Peak hours active (${currentHourUtc}:00 UTC). Immediate high-velocity dispatched: ${dispatchedCount}, off-peak held in queue: ${heldInQueueCount}.`;

    return success({
      isOffPeak,
      currentHourUtc,
      promotedCount,
      leasedCount: leasedJobs.length,
      dispatchedCount,
      heldInQueueCount,
      leasedJobs,
      summary,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[OpportunisticScheduler] Batch queue coordination failed', { error: errorMsg });
    return failure({
      code: 'COORDINATION_FAILED',
      message: `Failed to coordinate compute queue: ${errorMsg}`,
    });
  }
}

/**
 * Updates status of a compute job in D1.
 */
export async function updateJobStatus(
  db: D1Database,
  jobId: string,
  newStatus: ComputeJobStatus
): Promise<Result<ComputeJobRecord, SchedulerError>> {
  const activeDb = getDatabase(db);
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    const updateRes = await activeDb
      .prepare('UPDATE growth_v11_compute_jobs SET status = ?, updated_at = ? WHERE job_id = ?')
      .bind(newStatus, nowSec, jobId)
      .run();

    if ((updateRes.meta?.changes ?? 0) === 0) {
      return failure({
        code: 'JOB_NOT_FOUND',
        message: `Job ${jobId} not found for status update.`,
      });
    }

    const row = await activeDb
      .prepare('SELECT * FROM growth_v11_compute_jobs WHERE job_id = ?')
      .bind(jobId)
      .first<ComputeJobRow>();

    if (!row) {
      return failure({
        code: 'JOB_FETCH_FAILED',
        message: `Updated job ${jobId} could not be retrieved.`,
      });
    }

    return success(mapRowToRecord(row));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return failure({
      code: 'STATUS_UPDATE_FAILED',
      message: `Failed to update job status: ${errorMsg}`,
    });
  }
}
