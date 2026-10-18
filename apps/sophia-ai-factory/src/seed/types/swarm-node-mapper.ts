/**
 * Row-to-Domain Mapper for Autonomous Swarm Nodes
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 *
 * @module seed/types/swarm-node-mapper
 */

import type { AutonomousSwarmNodeRow, SwarmNode } from './swarm-node-types';

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapRowToSwarmNode(row: AutonomousSwarmNodeRow): SwarmNode {
  return {
    id: row.id,
    nodeName: row.node_name,
    region: row.region,
    role: row.role,
    status: row.status,
    endpointUrl: row.endpoint_url,
    lastHeartbeatAt: row.last_heartbeat_at,
    cpuLoadPct: row.cpu_load_pct,
    memoryLoadPct: row.memory_load_pct,
    activeTasks: row.active_tasks,
    maxConcurrency: row.max_concurrency,
    isHealthy: row.is_healthy === 1,
    capabilities: safeParseJson<string[]>(row.capabilities_json, []),
    metadata: safeParseJson<Record<string, unknown>>(row.metadata_json, {}),
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  };
}
