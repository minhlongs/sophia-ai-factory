/**
 * Fair-Share GPU Scheduler & Two-Lane Queue Arbitration Service
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * Implements:
 * - Two-lane queue arbitration (Priority Lane for Enterprise/Master vs Standard Lane for Basic/Pro)
 * - Tenant concurrency throttling (limits active renders per org)
 * - Atomic job leasing with lease renewal and recovery of expired leases
 * - Queue state transitions (enqueue, complete, fail, cancel, metrics)
 *
 * @module tree/queue/fair-share-gpu-scheduler
 */

import type { D1Database } from '@/seed/db/client';
import type {
  VideoRenderJob,
  VideoRenderRow,
  EnqueueJobInput,
  SchedulerConfig,
  LeaseJobResult,
  QueueMetrics,
  QueueLane,
  JobStatus,
} from '@/seed/types/video-render-queue';
import {
  DEFAULT_SCHEDULER_CONFIG,
  getPriorityScoreForTier,
  getLaneForTier,
  mapRowToJob,
} from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Generate a random UUID-like identifier without external dependencies
 */
function generateJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `vrj_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `vrj_${timestamp}${randomPart}`;
}

/**
 * Recover expired leases: any job that was leased but the worker failed to refresh
 * the lease before `leased_until` is returned to the 'queued' state.
 */
export async function recoverExpiredLeases(
  db: D1Database,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<number> {
  try {
    const res = await db
      .prepare(
        `UPDATE video_render_jobs
         SET status = 'queued',
             leased_by = NULL,
             leased_until = NULL,
             updated_at = ?
         WHERE status = 'leased' AND leased_until < ?`,
      )
      .bind(nowSeconds, nowSeconds)
      .run();

    const recoveredCount = res.meta?.changes ?? 0;
    if (recoveredCount > 0) {
      logger.info(`[gpu-scheduler] Recovered ${recoveredCount} expired leased jobs to queued`);
    }
    return recoveredCount;
  } catch (error) {
    logger.warn('[gpu-scheduler] Error recovering expired leases', { error: String(error) });
    return 0;
  }
}

/**
 * Get count of active renders (leased + rendering) for a tenant organization
 */
export async function getTenantActiveRenderCount(
  db: D1Database,
  orgId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<number> {
  try {
    const row = await db
      .prepare(
        `SELECT COUNT(*) as count FROM video_render_jobs
         WHERE org_id = ? AND (
           status = 'rendering' OR
           (status = 'leased' AND leased_until >= ?)
         )`,
      )
      .bind(orgId, nowSeconds)
      .first<{ count: number }>();

    return row?.count ?? 0;
  } catch (error) {
    logger.warn('[gpu-scheduler] Error fetching tenant active render count', {
      orgId,
      error: String(error),
    });
    return 0;
  }
}

/**
 * Resolve concurrency limit for an organization given its tier
 */
export function getTenantConcurrencyLimit(
  tier: string | null | undefined,
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): number {
  const limits = config.maxActiveRendersPerTenant ?? DEFAULT_SCHEDULER_CONFIG.maxActiveRendersPerTenant!;
  const normalizedTier = (tier || 'basic').toLowerCase();

  return (
    limits[normalizedTier] ??
    limits[tier?.toUpperCase() || ''] ??
    limits.default ??
    5
  );
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

/**
 * Lease the next available job for a worker using atomic CAS and fair-share arbitration
 */
export async function leaseNextJob(
  db: D1Database,
  workerId: string,
  leaseDurationSeconds = 60,
  lanePreference?: QueueLane,
  customConfig?: Partial<SchedulerConfig>,
): Promise<LeaseJobResult> {
  const config: SchedulerConfig = { ...DEFAULT_SCHEDULER_CONFIG, ...customConfig };
  const now = Math.floor(Date.now() / 1000);
  const leasedUntil = now + (leaseDurationSeconds || config.defaultLeaseDurationSeconds || 60);

  // Step 1: Recover any expired leases
  await recoverExpiredLeases(db, now);

  // Step 2: Determine lane order based on preference or fair-share
  const lanesToScan: QueueLane[] = lanePreference
    ? [lanePreference, lanePreference === 'priority' ? 'standard' : 'priority']
    : ['priority', 'standard'];

  let throttledCount = 0;

  for (const lane of lanesToScan) {
    // Fetch candidate queued jobs in current lane ordered by priority score DESC and created_at ASC
    const candidates = await db
      .prepare(
        `SELECT * FROM video_render_jobs
         WHERE lane = ? AND (
           status = 'queued' OR
           (status = 'leased' AND leased_until < ?)
         )
         ORDER BY priority_score DESC, created_at ASC
         LIMIT 25`,
      )
      .bind(lane, now)
      .all<VideoRenderRow>();

    const rows = candidates.results ?? [];
    if (rows.length === 0) {
      continue;
    }

    for (const candidate of rows) {
      // Step 3: Check tenant concurrency limits
      const activeCount = await getTenantActiveRenderCount(db, candidate.org_id, now);
      const tenantLimit = getTenantConcurrencyLimit(candidate.tier, config);

      if (activeCount >= tenantLimit) {
        throttledCount++;
        continue;
      }

      // Step 4: Atomic CAS lease update
      const updateResult = await db
        .prepare(
          `UPDATE video_render_jobs
           SET status = 'leased',
               leased_by = ?,
               leased_until = ?,
               updated_at = ?
           WHERE id = ? AND (
             status = 'queued' OR
             (status = 'leased' AND leased_until < ?)
           )`,
        )
        .bind(workerId, leasedUntil, now, candidate.id, now)
        .run();

      const changes = updateResult.meta?.changes ?? 0;
      if (changes > 0) {
        const leasedRow: VideoRenderRow = {
          ...candidate,
          status: 'leased',
          leased_by: workerId,
          leased_until: leasedUntil,
          updated_at: now,
        };
        const leasedJob = mapRowToJob(leasedRow);

        logger.info(
          `[gpu-scheduler] Worker ${workerId} leased job ${candidate.id} (lane=${lane}, score=${candidate.priority_score})`,
        );

        return {
          leased: true,
          job: leasedJob,
        };
      }
      // CAS contention: another worker claimed it, continue search
    }
  }

  if (throttledCount > 0) {
    return {
      leased: false,
      reason: 'TENANT_CONCURRENCY_LIMIT',
    };
  }

  return {
    leased: false,
    reason: 'NO_JOBS',
  };
}

/**
 * Renew an active lease for an ongoing render operation
 */
export async function renewLease(
  db: D1Database,
  jobId: string,
  workerId: string,
  additionalDurationSeconds = 60,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const newLeasedUntil = now + additionalDurationSeconds;

  const res = await db
    .prepare(
      `UPDATE video_render_jobs
       SET leased_until = ?,
           updated_at = ?
       WHERE id = ? AND status = 'leased' AND leased_by = ?`,
    )
    .bind(newLeasedUntil, now, jobId, workerId)
    .run();

  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Transition a job from leased to rendering
 */
export async function markJobRendering(
  db: D1Database,
  jobId: string,
  workerId: string,
  provider?: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);

  const res = await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = 'rendering',
           provider = COALESCE(?, provider),
           updated_at = ?
       WHERE id = ? AND (status = 'leased' OR status = 'rendering') AND leased_by = ?`,
    )
    .bind(provider || null, now, jobId, workerId)
    .run();

  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Complete a render job with the resulting asset URL
 */
export async function completeJob(
  db: D1Database,
  jobId: string,
  resultUrl: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);

  const res = await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = 'completed',
           result_url = ?,
           leased_by = NULL,
           leased_until = NULL,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(resultUrl, now, jobId)
    .run();

  const success = (res.meta?.changes ?? 0) > 0;
  if (success) {
    logger.info(`[gpu-scheduler] Job ${jobId} completed with resultUrl=${resultUrl}`);
  }
  return success;
}

/**
 * Record a failure on a job, incrementing retry count and routing to DLQ if max retries reached
 */
export async function failJob(
  db: D1Database,
  jobId: string,
  errorMessage: string,
  options?: { routeToDlq?: boolean; dlqReason?: string },
): Promise<{
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  shouldDlq: boolean;
  job?: VideoRenderJob;
}> {
  const now = Math.floor(Date.now() / 1000);

  // Retrieve current retry status
  const existing = await db
    .prepare(`SELECT * FROM video_render_jobs WHERE id = ?`)
    .bind(jobId)
    .first<VideoRenderRow>();

  if (!existing) {
    throw new Error(`Job ${jobId} not found`);
  }

  const nextRetryCount = existing.retry_count + 1;
  const isDlq = options?.routeToDlq || nextRetryCount >= existing.max_retries;
  const nextStatus: JobStatus = isDlq ? 'dlq' : 'queued';
  const dlqReason = isDlq
    ? options?.dlqReason || (nextRetryCount >= existing.max_retries ? 'MAX_RETRIES_EXCEEDED' : 'FATAL_ERROR')
    : null;

  await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = ?,
           error_message = ?,
           retry_count = ?,
           dlq_reason = ?,
           leased_by = NULL,
           leased_until = NULL,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(nextStatus, errorMessage, nextRetryCount, dlqReason, now, jobId)
    .run();

  const updatedRow: VideoRenderRow = {
    ...existing,
    status: nextStatus,
    error_message: errorMessage,
    retry_count: nextRetryCount,
    dlq_reason: dlqReason,
    leased_by: null,
    leased_until: null,
    updated_at: now,
  };

  const updatedJob = mapRowToJob(updatedRow);

  logger.warn(
    `[gpu-scheduler] Job ${jobId} failed (attempt ${nextRetryCount}/${existing.max_retries}) -> status=${nextStatus}`,
    { errorMessage, dlqReason },
  );

  return {
    status: nextStatus,
    retryCount: nextRetryCount,
    maxRetries: existing.max_retries,
    shouldDlq: isDlq,
    job: updatedJob,
  };
}

/**
 * Cancel a job if it has not yet reached a terminal state
 */
export async function cancelJob(
  db: D1Database,
  jobId: string,
  orgId?: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  let query = `UPDATE video_render_jobs
               SET status = 'failed',
                   error_message = 'Cancelled by user or operator',
                   leased_by = NULL,
                   leased_until = NULL,
                   updated_at = ?
               WHERE id = ? AND status IN ('queued', 'leased')`;
  const params: unknown[] = [now, jobId];

  if (orgId) {
    query += ` AND org_id = ?`;
    params.push(orgId);
  }

  const res = await db.prepare(query).bind(...params).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Get job by ID with optional tenant isolation check
 */
export async function getJobById(
  db: D1Database,
  jobId: string,
  orgId?: string,
): Promise<VideoRenderJob | null> {
  let query = `SELECT * FROM video_render_jobs WHERE id = ?`;
  const params: unknown[] = [jobId];

  if (orgId) {
    query += ` AND org_id = ?`;
    params.push(orgId);
  }

  const row = await db.prepare(query).bind(...params).first<VideoRenderRow>();
  if (!row) return null;
  return mapRowToJob(row);
}

/**
 * Aggregate queue metrics across lanes and statuses
 */
export async function getQueueMetrics(db: D1Database): Promise<QueueMetrics> {
  const emptyStatuses: Record<JobStatus, number> = {
    queued: 0,
    leased: 0,
    rendering: 0,
    completed: 0,
    failed: 0,
    dlq: 0,
  };

  const metrics: QueueMetrics = {
    priority: { ...emptyStatuses },
    standard: { ...emptyStatuses },
    totalActive: 0,
    totalQueued: 0,
    totalDlq: 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  try {
    const rows = await db
      .prepare(
        `SELECT lane, status, COUNT(*) as count
         FROM video_render_jobs
         GROUP BY lane, status`,
      )
      .all<{ lane: QueueLane; status: JobStatus; count: number }>();

    for (const r of rows.results ?? []) {
      if (r.lane === 'priority' || r.lane === 'standard') {
        if (metrics[r.lane][r.status] !== undefined) {
          metrics[r.lane][r.status] = r.count;
        }
      }
    }

    metrics.totalActive =
      metrics.priority.leased +
      metrics.priority.rendering +
      metrics.standard.leased +
      metrics.standard.rendering;

    metrics.totalQueued = metrics.priority.queued + metrics.standard.queued;
    metrics.totalDlq = metrics.priority.dlq + metrics.standard.dlq;
  } catch (error) {
    logger.warn('[gpu-scheduler] Error fetching queue metrics', { error: String(error) });
  }

  return metrics;
}
