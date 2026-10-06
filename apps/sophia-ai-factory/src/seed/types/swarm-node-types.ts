/**
 * Autonomous Swarm Node Contracts & Types
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/swarm-node-types
 */

export const SWARM_REGIONS = ['apac', 'us', 'eu', 'global'] as const;
export type SwarmRegion = (typeof SWARM_REGIONS)[number];

export const SWARM_NODE_ROLES = [
  'sales_qualifier',
  'retention_flywheel',
  'edge_healer',
  'coordinator',
  'general_worker',
] as const;
export type SwarmNodeRole = (typeof SWARM_NODE_ROLES)[number];

export const SWARM_NODE_STATUSES = [
  'active',
  'degraded',
  'isolated',
  'draining',
  'offline',
] as const;
export type SwarmNodeStatus = (typeof SWARM_NODE_STATUSES)[number];

export interface AutonomousSwarmNodeRow {
  id: string;
  node_name: string;
  region: SwarmRegion;
  role: SwarmNodeRole;
  status: SwarmNodeStatus;
  endpoint_url: string | null;
  last_heartbeat_at: number;
  cpu_load_pct: number;
  memory_load_pct: number;
  active_tasks: number;
  max_concurrency: number;
  is_healthy: number; // 0 | 1
  capabilities_json: string;
  metadata_json: string;
  registered_at: number;
  updated_at: number;
}

export interface SwarmNode {
  id: string;
  nodeName: string;
  region: SwarmRegion;
  role: SwarmNodeRole;
  status: SwarmNodeStatus;
  endpointUrl: string | null;
  lastHeartbeatAt: number;
  cpuLoadPct: number;
  memoryLoadPct: number;
  activeTasks: number;
  maxConcurrency: number;
  isHealthy: boolean;
  capabilities: string[];
  metadata: Record<string, unknown>;
  registeredAt: number;
  updatedAt: number;
}

export interface RegisterSwarmNodeInput {
  id?: string;
  nodeName: string;
  region: SwarmRegion;
  role: SwarmNodeRole;
  endpointUrl?: string | null;
  maxConcurrency?: number;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface HeartbeatTelemetryInput {
  nodeId: string;
  cpuLoadPct: number;
  memoryLoadPct: number;
  activeTasks: number;
  isHealthy?: boolean;
}

export interface SwarmClusterTopology {
  totalNodes: number;
  activeNodesCount: number;
  degradedNodesCount: number;
  isolatedNodesCount: number;
  coordinatorNodeId: string | null;
  regionalDistribution: Record<SwarmRegion, number>;
  nodes: SwarmNode[];
}

export interface SwarmTaskRequest {
  taskId?: string;
  taskType: 'lead_qualification' | 'retention_sweep' | 'health_telemetry_probe' | 'edge_healing_action';
  payload: Record<string, unknown>;
  preferredRegion?: SwarmRegion;
  requiredRole: SwarmNodeRole;
}

export interface SwarmTaskAssignment {
  taskId: string;
  assignedNodeId: string;
  endpointUrl: string | null;
  assignedAt: number;
  status: 'dispatched' | 'rejected_overload' | 'no_healthy_nodes';
}

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
