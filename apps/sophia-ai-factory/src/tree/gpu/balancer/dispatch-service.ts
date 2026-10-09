/**
 * Edge GPU Workload Balancer: Video Render Dispatch Service
 *
 * Implements:
 * - Optimal node selection
 * - Atomic job registration and node load accounting in D1
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/balancer/dispatch-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type GpuComputeNodeDbRow,
  type VideoRenderJobInput,
  type DispatchResult,
  GATE_10_CONSTANTS,
  mapRowToGpuComputeNode,
  videoRenderJobInputSchema,
} from '@/seed/types/edge-gpu-mesh';
import { executeBatchStatements } from './batch-executor';
import { selectOptimalComputeNode } from './node-selector';
import { estimateRenderMetrics } from './render-metrics';

/**
 * Dispatches an AI video render task to the optimal edge GPU node.
 * Atomically updates node load and records dispatch in D1.
 */
export async function dispatchRenderJob(
  db: D1Database,
  jobInput: VideoRenderJobInput,
): Promise<DispatchResult> {
  const validatedJob = videoRenderJobInputSchema.parse(jobInput);

  // 1. Fetch available nodes
  const nodeRowsResult = await db
    .prepare('SELECT * FROM gpu_compute_nodes WHERE is_healthy = 1 AND status != ? ORDER BY current_load_pct ASC')
    .bind('offline')
    .all<GpuComputeNodeDbRow>();

  const nodeRows = (nodeRowsResult.results ?? []) as GpuComputeNodeDbRow[];
  if (nodeRows.length === 0) {
    throw new Error('No active GPU compute nodes found in the edge mesh');
  }

  const nodes = nodeRows.map(mapRowToGpuComputeNode);
  const selectedNode = selectOptimalComputeNode(nodes, validatedJob);

  const { estimatedDurationMs, estimatedCostCents } = estimateRenderMetrics(
    selectedNode,
    validatedJob,
  );

  const dispatchId = `disp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = Date.now();
  const slaTargetMs = GATE_10_CONSTANTS.FOUR_K_MAX_RENDER_MS;

  // 2. Insert dispatch record and update node capacity atomically
  const insertDispatchStmt = db
    .prepare(
      `INSERT INTO video_render_dispatches (
        dispatch_id, tenant_id, job_id, node_id, video_resolution,
        video_duration_seconds, frame_count, codec, status, priority_score,
        spot_pricing_applied, cost_cents, queue_wait_ms, sla_target_ms,
        sla_breached, reroute_count, failover_history_json, dispatched_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      dispatchId,
      validatedJob.tenantId,
      validatedJob.jobId,
      selectedNode.nodeId,
      validatedJob.videoResolution,
      validatedJob.videoDurationSeconds,
      validatedJob.frameCount,
      validatedJob.codec ?? 'h264',
      'dispatched',
      validatedJob.priorityScore ?? 100,
      validatedJob.allowSpot !== false ? 1 : 0,
      estimatedCostCents,
      0, // queue wait ms
      slaTargetMs,
      0, // sla_breached
      0, // reroute_count
      '[]',
      now,
      now,
      now,
    );

  const nextLoadPct = Math.min(
    100.0,
    Number(
      (
        selectedNode.currentLoadPct +
        Math.max(1.0, 100.0 / Math.max(1, selectedNode.maxConcurrency))
      ).toFixed(2),
    ),
  );
  const nextStatus = nextLoadPct >= 95.0 ? 'busy' : 'online';

  const updateNodeStmt = db
    .prepare(
      `UPDATE gpu_compute_nodes
       SET active_render_jobs = active_render_jobs + 1,
           current_load_pct = ?,
           status = ?,
           updated_at = ?
       WHERE node_id = ?`,
    )
    .bind(nextLoadPct, nextStatus, now, selectedNode.nodeId);

  await executeBatchStatements(db, [insertDispatchStmt, updateNodeStmt]);

  return {
    dispatchId,
    jobId: validatedJob.jobId,
    tenantId: validatedJob.tenantId,
    selectedNodeId: selectedNode.nodeId,
    nodeRegion: selectedNode.region,
    gpuModel: selectedNode.gpuModel,
    estimatedCostCents,
    estimatedDurationMs,
    slaTargetMs,
    dispatchedAt: now,
  };
}
