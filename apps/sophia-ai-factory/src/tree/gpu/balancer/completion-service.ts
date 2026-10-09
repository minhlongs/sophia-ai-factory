/**
 * Edge GPU Workload Balancer: Render Job Completion Service
 *
 * Implements:
 * - Render duration recording & SLA breach evaluation
 * - Node active render decrement and capacity release
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/balancer/completion-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type VideoRenderDispatchDbRow,
  type CompleteJobResult,
  mapRowToVideoRenderDispatch,
} from '@/seed/types/edge-gpu-mesh';
import { executeBatchStatements } from './batch-executor';

/**
 * Records completion of a video render job, assesses SLA breaches, and releases node load.
 */
export async function completeRenderJob(
  db: D1Database,
  dispatchId: string,
  actualDurationMs: number,
  egressBytes: number = 0,
  errorMessage: string | null = null,
): Promise<CompleteJobResult> {
  const now = Date.now();

  const dispatchRow = await db
    .prepare('SELECT * FROM video_render_dispatches WHERE dispatch_id = ?')
    .bind(dispatchId)
    .first<VideoRenderDispatchDbRow>();

  if (!dispatchRow) {
    throw new Error(`Dispatch record not found: ${dispatchId}`);
  }

  const dispatch = mapRowToVideoRenderDispatch(dispatchRow);
  const status = errorMessage ? 'failed' : 'completed';
  const slaBreached = actualDurationMs > dispatch.slaTargetMs;

  const updateDispatchStmt = db
    .prepare(
      `UPDATE video_render_dispatches
       SET status = ?,
           render_duration_ms = ?,
           egress_bytes = ?,
           sla_breached = ?,
           error_message = ?,
           completed_at = ?,
           updated_at = ?
       WHERE dispatch_id = ?`,
    )
    .bind(
      status,
      actualDurationMs,
      egressBytes,
      slaBreached ? 1 : 0,
      errorMessage,
      now,
      now,
      dispatchId,
    );

  const durationSeconds = actualDurationMs / 1000;
  const updateNodeStmt = db
    .prepare(
      `UPDATE gpu_compute_nodes
       SET active_render_jobs = MAX(0, active_render_jobs - 1),
           total_renders_completed = total_renders_completed + 1,
           total_render_seconds = total_render_seconds + ?,
           current_load_pct = MAX(0.0, current_load_pct - 5.0),
           status = CASE WHEN status = 'busy' THEN 'online' ELSE status END,
           updated_at = ?
       WHERE node_id = ?`,
    )
    .bind(durationSeconds, now, dispatch.nodeId);

  await executeBatchStatements(db, [updateDispatchStmt, updateNodeStmt]);

  return {
    dispatchId,
    jobId: dispatch.jobId,
    status,
    renderDurationMs: actualDurationMs,
    slaBreached,
    actualCostCents: dispatch.costCents,
    completedAt: now,
  };
}
