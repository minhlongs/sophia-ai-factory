/**
 * Fair-Share GPU Scheduler: Lease Recovery and Renewal Service
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/scheduler/lease-recovery
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

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
