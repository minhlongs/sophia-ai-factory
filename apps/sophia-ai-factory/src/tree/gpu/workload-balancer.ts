/**
 * Dynamic Edge GPU Workload Balancer & Video Render Dispatcher
 *
 * Implements:
 * - Multi-factor composite fitness scoring (load 35%, latency 25%, spot 20%, health 20%)
 * - Hardware model & VRAM constraint verification for 4K / 8K rendering
 * - Cost-optimized 4K render dispatch targeting <15s SLA
 * - Sub-20ms dynamic failover rerouting for in-flight tasks upon node degradation/failure
 * - Cluster topology aggregation and node capacity management
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/workload-balancer
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type GpuComputeNode,
  type GpuComputeNodeDbRow,
  type VideoRenderDispatchDbRow,
  type VideoRenderJobInput,
  type DispatchResult,
  type RerouteResult,
  type CompleteJobResult,
  type GpuMeshTopology,
  type RegionCapacity,
  type GpuModel,
  type GpuComputeRegion,
  type FailoverEvent,
  FITNESS_WEIGHTS,
  RESOLUTION_VRAM_MIN_GB,
  GATE_10_CONSTANTS,
  mapRowToGpuComputeNode,
  mapRowToVideoRenderDispatch,
  videoRenderJobInputSchema,
} from '@/seed/types/edge-gpu-mesh';

/**
 * Executes a batch of statements safely across Cloudflare Workers D1 and test shims.
 */
async function executeBatchStatements(
  db: D1Database,
  statements: Array<{ run: () => Promise<unknown> }>,
): Promise<void> {
  if (typeof db.batch === 'function') {
    const results = await db.batch(
      statements as unknown as Parameters<D1Database['batch']>[0],
    );
    // If test shim returns the statement objects themselves without executing
    if (
      Array.isArray(results) &&
      results.length > 0 &&
      typeof (results[0] as { run?: unknown })?.run === 'function'
    ) {
      for (const stmt of statements) {
        await stmt.run();
      }
    }
  } else {
    for (const stmt of statements) {
      await stmt.run();
    }
  }
}

// ============================================================================
// Scoring & Node Selection Logic
// ============================================================================

/**
 * Calculates multi-factor fitness score (0.0 to 100.0+) for a GPU node against a job.
 *
 * Composite Weights:
 * - Load Score: 35%
 * - Latency Score: 25%
 * - Spot Cost Advantage: 20%
 * - Health Score: 20%
 * - Regional Proximity Bonus: +10 points
 */
export function calculateNodeFitnessScore(
  node: GpuComputeNode,
  job: VideoRenderJobInput,
): number {
  // If node is unhealthy or offline, score is 0
  if (!node.isHealthy || node.status === 'offline' || node.status === 'degraded') {
    return 0;
  }

  // 1. Load Score (0 - 35 points): lower load = higher score
  const availableCapacityPct = Math.max(0, 100 - node.currentLoadPct);
  const loadScore = (availableCapacityPct / 100) * 100 * FITNESS_WEIGHTS.LOAD;

  // 2. Latency Score (0 - 25 points): lower p95 latency = higher score
  // Clamp p95 latency between 0ms and 100ms
  const clampedLatency = Math.min(Math.max(0, node.p95LatencyMs), 100);
  const latencyScore = ((100 - clampedLatency) / 100) * 100 * FITNESS_WEIGHTS.LATENCY;

  // 3. Spot Cost Advantage (0 - 20 points): higher discount vs on-demand = higher score
  let spotDiscount = 0;
  if (node.onDemandPriceCentsPerHour > 0) {
    spotDiscount = Math.max(
      0,
      (node.onDemandPriceCentsPerHour - node.spotPriceCentsPerHour) /
        node.onDemandPriceCentsPerHour,
    );
  }
  const spotScore = spotDiscount * 100 * FITNESS_WEIGHTS.SPOT_PRICE;

  // 4. Health Score (0 - 20 points): health_score ranges 0.0 to 1.0
  const healthScore = Math.max(0, Math.min(1.0, node.healthScore)) * 100 * FITNESS_WEIGHTS.HEALTH;

  // 5. Preferred Region Bonus (+10 points)
  const regionBonus =
    job.preferredRegion && node.region === job.preferredRegion ? 10.0 : 0.0;

  const totalScore = Number(
    (loadScore + latencyScore + spotScore + healthScore + regionBonus).toFixed(3),
  );
  return totalScore;
}

/**
 * Validates hardware requirements and selects the highest scoring node.
 */
export function selectOptimalComputeNode(
  nodes: GpuComputeNode[],
  job: VideoRenderJobInput,
): GpuComputeNode {
  const minVramGb = RESOLUTION_VRAM_MIN_GB[job.videoResolution] ?? 24;
  const requestedCodec = job.codec ?? 'h264';

  // Filter eligible nodes:
  // - Node must be healthy and not offline / draining
  // - Node total VRAM per GPU must meet or exceed resolution requirements
  // - Node must not be saturated (active jobs < max concurrency)
  // - Node must support requested codec
  const candidates = nodes.filter((node) => {
    if (!node.isHealthy) return false;
    if (node.status === 'offline' || node.status === 'degraded' || node.status === 'draining') {
      return false;
    }
    if (node.vramGbPerGpu < minVramGb) return false;
    if (node.activeRenderJobs >= node.maxConcurrency) return false;
    if (node.currentLoadPct >= 98.0) return false;

    // Check resolution capability
    if (job.videoResolution === '8K' && node.maxResolution !== '8K') return false;
    if (
      job.videoResolution === '4K' &&
      node.maxResolution !== '4K' &&
      node.maxResolution !== '8K'
    ) {
      return false;
    }

    // Codec support check (fallback to true if list is empty)
    if (node.supportedCodecs.length > 0 && !node.supportedCodecs.includes(requestedCodec)) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    // If strict candidates empty, try fallback to any online node with sufficient VRAM
    const fallbackCandidates = nodes.filter(
      (n) => n.isHealthy && n.status !== 'offline' && n.vramGbPerGpu >= minVramGb,
    );
    if (fallbackCandidates.length > 0) {
      fallbackCandidates.sort((a, b) => b.healthScore - a.healthScore);
      return fallbackCandidates[0];
    }
    throw new Error(
      `No available GPU compute node found matching resolution ${job.videoResolution} and codec ${requestedCodec}`,
    );
  }

  // Sort candidates by composite fitness score descending
  candidates.sort((a, b) => {
    const scoreA = calculateNodeFitnessScore(a, job);
    const scoreB = calculateNodeFitnessScore(b, job);
    return scoreB - scoreA;
  });

  return candidates[0];
}

/**
 * Calculates estimated rendering duration and cost for a job on a specific node.
 */
export function estimateRenderMetrics(
  node: GpuComputeNode,
  job: VideoRenderJobInput,
): { estimatedDurationMs: number; estimatedCostCents: number } {
  // Base render throughput multipliers (duration per 1s of video)
  // H100: 0.10s / 1s of 4K video (60s video -> 6s render)
  // A100: 0.15s / 1s of 4K video (60s video -> 9s render)
  // L40S: 0.18s / 1s of 4K video (60s video -> 10.8s render)
  // RTX4090: 0.22s / 1s of 4K video
  const modelMultipliers: Record<GpuModel, number> = {
    H100: 0.1,
    A100: 0.15,
    L40S: 0.18,
    RTX4090: 0.22,
  };

  const resMultipliers: Record<string, number> = {
    '720p': 0.5,
    '1080p': 0.75,
    '4K': 1.0,
    '8K': 2.5,
  };

  const baseRate = modelMultipliers[node.gpuModel] ?? 0.15;
  const resRate = resMultipliers[job.videoResolution] ?? 1.0;
  const loadPenalty = 1 + (node.currentLoadPct / 100) * 0.4;

  const rawDurationSeconds = job.videoDurationSeconds * baseRate * resRate * loadPenalty;
  // Ensure duration is strictly positive and rounded to ms
  const estimatedDurationMs = Math.max(500, Math.round(rawDurationSeconds * 1000));

  // Hourly cost calculation
  const hourlyRateCents =
    job.allowSpot !== false ? node.spotPriceCentsPerHour : node.onDemandPriceCentsPerHour;
  const hours = estimatedDurationMs / (3600 * 1000);
  const estimatedCostCents = Math.max(1, Math.ceil(hours * hourlyRateCents));

  return { estimatedDurationMs, estimatedCostCents };
}

// ============================================================================
// Service Operations
// ============================================================================

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

  // 3. Atomic batch:
  // - Mark failed node degraded / unhealthy
  // - Reassign dispatch to optimal node and record failover
  // - Decrement load on failed node, increment on optimal node
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
    .bind(optimalNode.nodeId, JSON.stringify(updatedHistory), now, dispatchId);

  const incrementNewNodeStmt = db
    .prepare(
      `UPDATE gpu_compute_nodes
       SET active_render_jobs = active_render_jobs + 1,
           updated_at = ?
       WHERE node_id = ?`,
    )
    .bind(now, optimalNode.nodeId);

  await executeBatchStatements(db, [
    isolateFailedNodeStmt,
    updateDispatchStmt,
    incrementNewNodeStmt,
  ]);

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

/**
 * Aggregates cluster topology, regional capacities, and hardware model distribution.
 */
export async function getMeshTopology(db: D1Database): Promise<GpuMeshTopology> {
  const rowsResult = await db
    .prepare('SELECT * FROM gpu_compute_nodes ORDER BY region ASC')
    .all<GpuComputeNodeDbRow>();

  const rows = (rowsResult.results ?? []) as GpuComputeNodeDbRow[];
  const nodes = rows.map(mapRowToGpuComputeNode);

  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter((n) => n.status === 'online' || n.status === 'busy').length;
  const degradedNodes = nodes.filter((n) => n.status === 'degraded' || n.status === 'offline').length;
  const totalGpus = nodes.reduce((sum, n) => sum + n.gpuCount, 0);
  const totalVramGb = nodes.reduce((sum, n) => sum + n.totalVramGb, 0);
  const activeRenderJobs = nodes.reduce((sum, n) => sum + n.activeRenderJobs, 0);
  const averageLoadPct =
    totalNodes > 0
      ? Number((nodes.reduce((sum, n) => sum + n.currentLoadPct, 0) / totalNodes).toFixed(2))
      : 0.0;

  // Regional capacities
  const regionMap = new Map<GpuComputeRegion, GpuComputeNode[]>();
  for (const node of nodes) {
    const list = regionMap.get(node.region) ?? [];
    list.push(node);
    regionMap.set(node.region, list);
  }

  const regionCapacities: RegionCapacity[] = Array.from(regionMap.entries()).map(
    ([region, rNodes]) => ({
      region,
      totalNodes: rNodes.length,
      onlineNodes: rNodes.filter((n) => n.status === 'online' || n.status === 'busy').length,
      totalGpus: rNodes.reduce((sum, n) => sum + n.gpuCount, 0),
      totalVramGb: rNodes.reduce((sum, n) => sum + n.totalVramGb, 0),
      averageLoadPct: Number(
        (rNodes.reduce((sum, n) => sum + n.currentLoadPct, 0) / rNodes.length).toFixed(2),
      ),
      activeRenderJobs: rNodes.reduce((sum, n) => sum + n.activeRenderJobs, 0),
    }),
  );

  // Models summary
  const modelsSummary: Record<GpuModel, { count: number; online: number; activeJobs: number }> = {
    H100: { count: 0, online: 0, activeJobs: 0 },
    A100: { count: 0, online: 0, activeJobs: 0 },
    L40S: { count: 0, online: 0, activeJobs: 0 },
    RTX4090: { count: 0, online: 0, activeJobs: 0 },
  };

  for (const node of nodes) {
    if (modelsSummary[node.gpuModel]) {
      modelsSummary[node.gpuModel].count += 1;
      if (node.status === 'online' || node.status === 'busy') {
        modelsSummary[node.gpuModel].online += 1;
      }
      modelsSummary[node.gpuModel].activeJobs += node.activeRenderJobs;
    }
  }

  return {
    totalNodes,
    onlineNodes,
    degradedNodes,
    totalGpus,
    totalVramGb,
    activeRenderJobs,
    averageLoadPct,
    regionCapacities,
    modelsSummary,
  };
}
