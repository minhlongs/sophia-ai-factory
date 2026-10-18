/**
 * Atomic D1 Batch Updates for In-Flight GPU Failover Rerouting
 *
 * Layer: tree/gpu
 * @module tree/gpu/balancer/reroute-batch-updates
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { FailoverEvent } from '@/seed/types/edge-gpu-mesh';
import { executeBatchStatements } from './batch-executor';

export interface FailoverBatchParams {
  db: D1Database;
  dispatchId: string;
  failedNodeId: string;
  optimalNodeId: string;
  updatedHistory: FailoverEvent[];
  now: number;
}

export async function executeFailoverStateUpdates(
  params: FailoverBatchParams,
): Promise<void> {
  const { db, dispatchId, failedNodeId, optimalNodeId, updatedHistory, now } = params;

  const isolateFailedNodeStmt = db
    .prepare(
      `UPDATE gpu_compute_nodes
       SET status = 'degraded',
           is_healthy = 0,
           health_score = 0.2,
           active_render_jobs = MAX(0, active_render_jobs - 1),
           updated_at = ?
       WHERE node_id = ?`,
    )
    .bind(now, failedNodeId);

  const updateDispatchStmt = db
    .prepare(
      `UPDATE video_render_dispatches
       SET node_id = ?,
           status = 'rerouted',
           reroute_count = reroute_count + 1,
           failover_history_json = ?,
           updated_at = ?
       WHERE dispatch_id = ?`,
    )
    .bind(optimalNodeId, JSON.stringify(updatedHistory), now, dispatchId);

  const incrementNewNodeStmt = db
    .prepare(
      `UPDATE gpu_compute_nodes
       SET active_render_jobs = active_render_jobs + 1,
           updated_at = ?
       WHERE node_id = ?`,
    )
    .bind(now, optimalNodeId);

  await executeBatchStatements(db, [
    isolateFailedNodeStmt,
    updateDispatchStmt,
    incrementNewNodeStmt,
  ]);
}
