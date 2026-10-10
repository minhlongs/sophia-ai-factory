/**
 * Swarm Task Scheduler & Node Lookup
 *
 * @module tree/swarm/coordinator/task-scheduler
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmNode,
  AutonomousSwarmNodeRow,
  SwarmTaskRequest,
  SwarmTaskAssignment,
  SwarmRegion,
  SwarmNodeRole,
  SwarmNodeStatus,
} from '@/seed/types/autonomous-swarm';
import { mapRowToSwarmNode } from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { DEFAULT_HEARTBEAT_TIMEOUT_MS } from './types';

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
