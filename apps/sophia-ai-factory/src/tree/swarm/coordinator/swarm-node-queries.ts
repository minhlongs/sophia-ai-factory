/**
 * Swarm Node D1 Queries
 *
 * @module tree/swarm/coordinator/swarm-node-queries
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmNode,
  AutonomousSwarmNodeRow,
  SwarmRegion,
  SwarmNodeRole,
  SwarmNodeStatus,
} from '@/seed/types/autonomous-swarm';
import { mapRowToSwarmNode } from '@/seed/types/autonomous-swarm';

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
