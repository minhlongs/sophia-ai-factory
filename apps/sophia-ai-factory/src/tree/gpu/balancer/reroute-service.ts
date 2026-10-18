/**
 * Edge GPU Workload Balancer: Dynamic In-Flight Failover Rerouting Service
 *
 * Implements:
 * - Sub-20ms failover detection and node migration
 * - Degraded node isolation and state updates in D1
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/balancer/reroute-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type GpuComputeNodeDbRow,
  type VideoRenderDispatchDbRow,
  type RerouteResult,
  type FailoverEvent,
  GATE_10_CONSTANTS,
  mapRowToGpuComputeNode,
  mapRowToVideoRenderDispatch,
} from '@/seed/types/edge-gpu-mesh';
import { selectOptimalComputeNode } from './node-selector';
import { executeFailoverStateUpdates } from './reroute-batch-updates';

/**
 * Executes sub-20ms failover rerouting for an in-flight video render task.
 * Isolates the degraded node and migrates the task to the best candidate node.
 */
export async function rerouteInFlightJob(
  db: D1Database,
  dispatchId: string,
  failedNodeId: string,
  failureReason: string = 'node_unresponsive_or_degraded',
): Promise<RerouteResult> {
  const startTime = performance.now();
  const now = Date.now();

  // 1. Fetch dispatch record
  const dispatchRow = await db
    .prepare('SELECT * FROM video_render_dispatches WHERE dispatch_id = ?')
    .bind(dispatchId)
    .first<VideoRenderDispatchDbRow>();

  if (!dispatchRow) {
    throw new Error(`Dispatch record not found: ${dispatchId}`);
  }

  const dispatch = mapRowToVideoRenderDispatch(dispatchRow);
  if (dispatch.status === 'completed') {
    throw new Error(`Cannot reroute completed job: ${dispatchId}`);
  }

  // 2. Fetch available candidate nodes (excluding failed node)
  const candidateRows = await db
    .prepare(
      `SELECT * FROM gpu_compute_nodes
       WHERE node_id != ? AND is_healthy = 1 AND status IN ('online', 'busy')
       ORDER BY current_load_pct ASC`,
    )
    .bind(failedNodeId)
    .all<GpuComputeNodeDbRow>();

  const candidateNodes = (candidateRows.results ?? []).map(mapRowToGpuComputeNode);
  if (candidateNodes.length === 0) {
    throw new Error(`No available failover nodes found to reroute dispatch ${dispatchId}`);
  }

  const optimalNode = selectOptimalComputeNode(candidateNodes, {
    jobId: dispatch.jobId,
    tenantId: dispatch.tenantId,
    videoResolution: dispatch.videoResolution,
    videoDurationSeconds: dispatch.videoDurationSeconds,
    frameCount: dispatch.frameCount,
    codec: dispatch.codec,
  });

  const durationMs = Number((performance.now() - startTime).toFixed(2));
  const isSub20ms = durationMs < GATE_10_CONSTANTS.FAILOVER_MAX_REROUTE_MS;

  const failoverEvent: FailoverEvent = {
    fromNodeId: failedNodeId,
    toNodeId: optimalNode.nodeId,
    reason: failureReason,
    reroutedAt: now,
    durationMs,
  };

  const updatedHistory = [...dispatch.failoverHistory, failoverEvent];

  // 3. Atomic batch state updates
  await executeFailoverStateUpdates({
    db,
    dispatchId,
    failedNodeId,
    optimalNodeId: optimalNode.nodeId,
    updatedHistory,
    now,
  });

  return {
    success: true,
    dispatchId,
    previousNodeId: failedNodeId,
    newNodeId: optimalNode.nodeId,
    rerouteDurationMs: durationMs,
    isSub20ms,
    timestamp: now,
  };
}
