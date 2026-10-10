/**
 * Autonomous Swarm Coordinator Core Service
 *
 * @module tree/swarm/coordinator/swarm-coordinator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmNode,
  RegisterSwarmNodeInput,
  SwarmClusterTopology,
  SwarmRegion,
} from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { DEFAULT_HEARTBEAT_TIMEOUT_MS } from './types';
import { electLeaderFromCandidates } from './heartbeat-tracker';
import { getSwarmNodeById, listSwarmNodes } from './task-scheduler';

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
 * Executes cluster leader election across all registered coordinator nodes.
 */
export async function electLeaderCoordinator(db: D1Database): Promise<SwarmNode | null> {
  const coordinators = await listSwarmNodes(db, { role: 'coordinator' });
  return electLeaderFromCandidates(coordinators);
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
