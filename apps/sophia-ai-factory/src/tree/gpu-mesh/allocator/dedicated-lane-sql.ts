/**
 * SQL update and release helpers for Dedicated Enterprise GPU Lane Allocator.
 * @module tree/gpu-mesh/allocator/dedicated-lane-sql
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export async function applyDedicatedLaneUpgradeAndConsumeMcu(params: {
  db: D1Database;
  jobId: string;
  reservationId: string;
  priorityScore: number;
  targetRegion: string;
  requestedMcu: number;
  now: number;
}): Promise<boolean> {
  const { db, jobId, reservationId, priorityScore, targetRegion, requestedMcu, now } = params;

  const jobUpdateRes = await db
    .prepare(
      `UPDATE video_render_jobs
       SET lane = 'priority',
           priority_score = ?1,
           reservation_id = ?2,
           target_region = ?3,
           updated_at = ?4
       WHERE id = ?5`,
    )
    .bind(priorityScore, reservationId, targetRegion, now, jobId)
    .run();

  if (!jobUpdateRes.success) {
    return false;
  }

  if (requestedMcu > 0) {
    await db
      .prepare(
        `UPDATE enterprise_gpu_reservations
         SET mcu_consumed = mcu_consumed + ?1,
             updated_at = ?2
         WHERE id = ?3`,
      )
      .bind(requestedMcu, now, reservationId)
      .run();
  }

  return true;
}

/**
 * Release dedicated lane upon job completion or failure, recording latency and executed region
 */
export async function releaseDedicatedLane(
  db: D1Database,
  jobId: string,
  executionResult?: {
    status?: 'completed' | 'failed';
    executionLatencyMs?: number;
    executedRegion?: string;
  },
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const status = executionResult?.status ?? 'completed';
    const latency = executionResult?.executionLatencyMs ?? null;
    const region = executionResult?.executedRegion ?? null;

    const res = await db
      .prepare(
        `UPDATE video_render_jobs
         SET status = ?1,
             execution_latency_ms = COALESCE(?2, execution_latency_ms),
             executed_region = COALESCE(?3, executed_region),
             updated_at = ?4
         WHERE id = ?5`,
      )
      .bind(status, latency, region, now, jobId)
      .run();

    return res.success;
  } catch (error) {
    logger.warn('[gpu-mesh] Error releasing dedicated lane', {
      jobId,
      error: String(error),
    });
    return false;
  }
}
