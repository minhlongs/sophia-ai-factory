/**
 * Autonomous Swarm Coordinator Engine
 *
 * Layer: tree/swarm (Domain services & pure algorithms)
 * Dependencies: @/seed/types/autonomous-swarm, @/seed/db/client, @/seed/utils/logger-utility
 *
 * Implements:
 * - Edge node registration with capability advertising
 * - Heartbeat ingestion with load and health telemetry
 * - Stale node detection & automated offline pruning
 * - Deterministic consensus leader election (fitness score + tie-breaking)
 * - Least-loaded task dispatch with preferred-region routing & global fallback
 * - Cluster topology aggregation
 *
 * @module tree/swarm/swarm-coordinator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmNode,
  AutonomousSwarmNodeRow,
  RegisterSwarmNodeInput,
  HeartbeatTelemetryInput,
  SwarmTaskRequest,
  SwarmTaskAssignment,
  SwarmClusterTopology,
  SwarmRegion,
  SwarmNodeRole,
  SwarmNodeStatus,
} from '@/seed/types/autonomous-swarm';
import { mapRowToSwarmNode } from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';

export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 60_000; // 60 seconds

/**
 * Computes deterministic fitness score for a candidate coordinator node.
 * Fitness = (100 - cpuLoadPct) * 0.4 + (100 - memoryLoadPct) * 0.4 + uptimeScore * 0.2
 */
export function computeCoordinatorFitness(node: SwarmNode, now: number = Date.now()): number {
  const cpuFitness = Math.max(0, 100 - node.cpuLoadPct) * 0.4;
  const memoryFitness = Math.max(0, 100 - node.memoryLoadPct) * 0.4;
  
  // Uptime score: bonus for stability, penalized if heartbeat is lagging
  const heartbeatLagMs = Math.max(0, now - node.lastHeartbeatAt);
  const freshnessScore = Math.max(0, 100 - (heartbeatLagMs / 1000));
  const uptimeScore = freshnessScore * 0.2;

  return Number((cpuFitness + memoryFitness + uptimeScore).toFixed(4));
}

/**
 * Pure consensus leader election among coordinator nodes.
 * Deterministically resolves the single active cluster leader.
 */
export function electLeaderFromCandidates(candidates: SwarmNode[], now: number = Date.now()): SwarmNode | null {
  const validCandidates = candidates.filter(
    (n) => n.role === 'coordinator' && n.status === 'active' && n.isHealthy && (now - n.lastHeartbeatAt <= DEFAULT_HEARTBEAT_TIMEOUT_MS)
  );

  if (validCandidates.length === 0) return null;

  // Sort by fitness descending; break ties deterministically by node ID ascending
  validCandidates.sort((a, b) => {
    const fitnessA = computeCoordinatorFitness(a, now);
    const fitnessB = computeCoordinatorFitness(b, now);
    if (Math.abs(fitnessB - fitnessA) > 0.0001) {
      return fitnessB - fitnessA;
    }
    return a.id.localeCompare(b.id);
  });

  return validCandidates[0] ?? null;
}

/**
 * Registers a new edge node or updates an existing node's configuration.
 */
export async function registerSwarmNode(
  db: D1Database,
  input: RegisterSwarmNodeInput
): Promise<SwarmNode> {
  const now = Date.now();
  const id = input.id ?? `node_${input.region}_${input.role}_${Math.random().toString(16).slice(2, 10)}`;
  const capabilitiesJson = JSON.stringify(input.capabilities ?? []);
  const metadataJson = JSON.stringify(input.metadata ?? {});
  const maxConcurrency = input.maxConcurrency ?? 50;
  const endpointUrl = input.endpointUrl ?? null;

  await db
    .prepare(`
      INSERT INTO autonomous_swarm_nodes (
        id, node_name, region, role, status, endpoint_url,
        last_heartbeat_at, cpu_load_pct, memory_load_pct, active_tasks,
        max_concurrency, is_healthy, capabilities_json, metadata_json,
        registered_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, 0.0, 0.0, 0, ?7, 1, ?8, ?9, ?10, ?11)
      ON CONFLICT(id) DO UPDATE SET
        node_name = excluded.node_name,
        region = excluded.region,
        role = excluded.role,
        endpoint_url = COALESCE(excluded.endpoint_url, autonomous_swarm_nodes.endpoint_url),
        max_concurrency = excluded.max_concurrency,
        capabilities_json = excluded.capabilities_json,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `)
    .bind(
      id,
      input.nodeName,
      input.region,
      input.role,
      endpointUrl,
      now,
      maxConcurrency,
      capabilitiesJson,
      metadataJson,
      now,
      now
    )
    .run();

  const node = await getSwarmNodeById(db, id);
  if (!node) {
    throw new Error(`Failed to retrieve registered swarm node: ${id}`);
  }

  logger.info('[swarm-coordinator] Node registered', { nodeId: id, role: input.role, region: input.region });
  return node;
}

/**
 * Fetches a single swarm node by ID.
 */
export async function getSwarmNodeById(
  db: D1Database,
  nodeId: string
): Promise<SwarmNode | null> {
  const row = await db
    .prepare('SELECT * FROM autonomous_swarm_nodes WHERE id = ?1 LIMIT 1')
    .bind(nodeId)
    .first<AutonomousSwarmNodeRow>();

  return row ? mapRowToSwarmNode(row) : null;
}

/**
 * Lists swarm nodes with optional role and status filters.
 */
export async function listSwarmNodes(
  db: D1Database,
  filter?: { role?: SwarmNodeRole; status?: SwarmNodeStatus; region?: SwarmRegion }
): Promise<SwarmNode[]> {
  let query = 'SELECT * FROM autonomous_swarm_nodes WHERE 1=1';
  const params: unknown[] = [];

  if (filter?.role) {
    params.push(filter.role);
    query += ` AND role = ?${params.length}`;
  }
  if (filter?.status) {
    params.push(filter.status);
    query += ` AND status = ?${params.length}`;
  }
  if (filter?.region) {
    params.push(filter.region);
    query += ` AND region = ?${params.length}`;
  }

  query += ' ORDER BY region ASC, role ASC, id ASC';

  const { results } = await db.prepare(query).bind(...params).all<AutonomousSwarmNodeRow>();
  return (results ?? []).map(mapRowToSwarmNode);
}

/**
 * Records a periodic heartbeat telemetry payload from an edge node.
 */
export async function recordNodeHeartbeat(
  db: D1Database,
  input: HeartbeatTelemetryInput
): Promise<{ success: boolean; acknowledgedAt: number }> {
  const now = Date.now();
  const isHealthyNum = input.isHealthy === false ? 0 : 1;
  const statusUpdate = input.isHealthy === false ? 'degraded' : 'active';

  const result = await db
    .prepare(`
      UPDATE autonomous_swarm_nodes
      SET
        last_heartbeat_at = ?1,
        cpu_load_pct = ?2,
        memory_load_pct = ?3,
        active_tasks = ?4,
        is_healthy = ?5,
        status = CASE WHEN status = 'isolated' THEN 'isolated' ELSE ?6 END,
        updated_at = ?7
      WHERE id = ?8
    `)
    .bind(
      now,
      Math.min(100, Math.max(0, input.cpuLoadPct)),
      Math.min(100, Math.max(0, input.memoryLoadPct)),
      Math.max(0, input.activeTasks),
      isHealthyNum,
      statusUpdate,
      now,
      input.nodeId
    )
    .run();

  const success = Boolean(result.meta.changes && result.meta.changes > 0);
  return { success, acknowledgedAt: now };
}

/**
 * Prunes nodes whose heartbeat has timed out past the threshold (default: 60s).
 * Marks dead nodes as 'offline' and sets is_healthy = 0.
 */
export async function pruneDeadNodes(
  db: D1Database,
  timeoutMs: number = DEFAULT_HEARTBEAT_TIMEOUT_MS
): Promise<{ prunedCount: number; nodeIds: string[] }> {
  const now = Date.now();
  const cutoffTime = now - timeoutMs;

  const { results } = await db
    .prepare(`
      SELECT id FROM autonomous_swarm_nodes
      WHERE last_heartbeat_at < ?1
        AND status NOT IN ('offline', 'isolated')
    `)
    .bind(cutoffTime)
    .all<{ id: string }>();

  const nodeIds = (results ?? []).map((r) => r.id);

  if (nodeIds.length > 0) {
    await db
      .prepare(`
        UPDATE autonomous_swarm_nodes
        SET
          status = 'offline',
          is_healthy = 0,
          updated_at = ?1
        WHERE last_heartbeat_at < ?2
          AND status NOT IN ('offline', 'isolated')
      `)
      .bind(now, cutoffTime)
      .run();

    logger.warn('[swarm-coordinator] Dead nodes pruned', { count: nodeIds.length, nodeIds });
  }

  return { prunedCount: nodeIds.length, nodeIds };
}

/**
 * Executes cluster leader election across all registered coordinator nodes.
 */
export async function electLeaderCoordinator(db: D1Database): Promise<SwarmNode | null> {
  const coordinators = await listSwarmNodes(db, { role: 'coordinator' });
  return electLeaderFromCandidates(coordinators);
}

/**
 * Dispatches a swarm task to the optimal least-loaded node.
 * Follows preferred-region priority with graceful cross-region failover.
 */
export async function dispatchSwarmTask(
  db: D1Database,
  request: SwarmTaskRequest
): Promise<SwarmTaskAssignment> {
  const now = Date.now();
  const taskId = request.taskId ?? `task_${Math.random().toString(16).slice(2, 10)}`;

  // Retrieve candidate nodes matching role and active status
  const nodes = await listSwarmNodes(db, { role: request.requiredRole, status: 'active' });
  const healthyNodes = nodes.filter(
    (n) => n.isHealthy && (now - n.lastHeartbeatAt <= DEFAULT_HEARTBEAT_TIMEOUT_MS)
  );

  if (healthyNodes.length === 0) {
    return {
      taskId,
      assignedNodeId: '',
      endpointUrl: null,
      assignedAt: now,
      status: 'no_healthy_nodes',
    };
  }

  // Calculate available capacity
  const eligibleNodes = healthyNodes
    .map((n) => ({
      node: n,
      availableCapacity: n.maxConcurrency - n.activeTasks,
      isPreferredRegion: request.preferredRegion ? n.region === request.preferredRegion : false,
    }))
    .filter((entry) => entry.availableCapacity > 0);

  if (eligibleNodes.length === 0) {
    return {
      taskId,
      assignedNodeId: '',
      endpointUrl: null,
      assignedAt: now,
      status: 'rejected_overload',
    };
  }

  // Sort candidates:
  // 1. Preferred region first
  // 2. Highest available capacity
  // 3. Lowest CPU load
  eligibleNodes.sort((a, b) => {
    if (a.isPreferredRegion !== b.isPreferredRegion) {
      return a.isPreferredRegion ? -1 : 1;
    }
    if (b.availableCapacity !== a.availableCapacity) {
      return b.availableCapacity - a.availableCapacity;
    }
    return a.node.cpuLoadPct - b.node.cpuLoadPct;
  });

  const selected = eligibleNodes[0].node;

  // Increment active task count on assigned node
  await db
    .prepare(`
      UPDATE autonomous_swarm_nodes
      SET active_tasks = active_tasks + 1, updated_at = ?1
      WHERE id = ?2
    `)
    .bind(now, selected.id)
    .run();

  logger.info('[swarm-coordinator] Task dispatched', {
    taskId,
    assignedNodeId: selected.id,
    region: selected.region,
    taskType: request.taskType,
  });

  return {
    taskId,
    assignedNodeId: selected.id,
    endpointUrl: selected.endpointUrl,
    assignedAt: now,
    status: 'dispatched',
  };
}

/**
 * Returns complete cluster topology and status metrics.
 */
export async function getSwarmClusterTopology(db: D1Database): Promise<SwarmClusterTopology> {
  const nodes = await listSwarmNodes(db);
  const now = Date.now();

  const regionalDistribution: Record<SwarmRegion, number> = {
    apac: 0,
    us: 0,
    eu: 0,
    global: 0,
  };

  let activeNodesCount = 0;
  let degradedNodesCount = 0;
  let isolatedNodesCount = 0;

  for (const node of nodes) {
    if (regionalDistribution[node.region] !== undefined) {
      regionalDistribution[node.region]++;
    }
    if (node.status === 'active' && node.isHealthy && (now - node.lastHeartbeatAt <= DEFAULT_HEARTBEAT_TIMEOUT_MS)) {
      activeNodesCount++;
    } else if (node.status === 'degraded') {
      degradedNodesCount++;
    } else if (node.status === 'isolated') {
      isolatedNodesCount++;
    }
  }

  const leader = electLeaderFromCandidates(nodes, now);

  return {
    totalNodes: nodes.length,
    activeNodesCount,
    degradedNodesCount,
    isolatedNodesCount,
    coordinatorNodeId: leader ? leader.id : null,
    regionalDistribution,
    nodes,
  };
}
