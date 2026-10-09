/**
 * Failover Node Selection, Node Isolation, and Sweeping
 *
 * @module tree/swarm/self-healing/remediation-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmNode,
  AutonomousSwarmNodeRow,
  EdgeHealingIncident,
  SwarmRegion,
} from '@/seed/types/autonomous-swarm';
import { mapRowToSwarmNode } from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { getCircuitBreakerMetrics } from './circuit-breaker';
import { logHealingIncident } from './incident-logger';

/**
 * Finds the optimal healthy failover node in an alternate region.
 */
export async function findOptimalFailoverNode(
  db: D1Database,
  failingNode: SwarmNode
): Promise<SwarmNode | null> {
  const fallbackRegions: SwarmRegion[] = failingNode.region === 'apac'
    ? ['us', 'eu', 'global']
    : failingNode.region === 'us'
    ? ['eu', 'apac', 'global']
    : failingNode.region === 'eu'
    ? ['us', 'apac', 'global']
    : ['apac', 'us', 'eu'];

  const { results } = await db
    .prepare(`
      SELECT * FROM autonomous_swarm_nodes
      WHERE role = ?1
        AND status = 'active'
        AND is_healthy = 1
        AND id != ?2
      ORDER BY cpu_load_pct ASC, active_tasks ASC
    `)
    .bind(failingNode.role, failingNode.id)
    .all<AutonomousSwarmNodeRow>();

  if (!results || results.length === 0) return null;

  const candidateNodes = results.map(mapRowToSwarmNode);

  // Pick first candidate matching region priority
  for (const region of fallbackRegions) {
    const match = candidateNodes.find((n) => n.region === region);
    if (match) return match;
  }

  // Fallback to any healthy node
  return candidateNodes[0] ?? null;
}

/**
 * Quarantines and isolates an unstable or degraded edge node.
 */
export async function isolateNode(
  db: D1Database,
  nodeId: string,
  reason: string
): Promise<EdgeHealingIncident> {
  const startTime = Date.now();
  const nodeRow = await db
    .prepare('SELECT * FROM autonomous_swarm_nodes WHERE id = ?1 LIMIT 1')
    .bind(nodeId)
    .first<AutonomousSwarmNodeRow>();

  if (!nodeRow) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const node = mapRowToSwarmNode(nodeRow);
  const previousState = node.status;

  const failoverNode = await findOptimalFailoverNode(db, node);

  await db
    .prepare(`
      UPDATE autonomous_swarm_nodes
      SET
        status = 'isolated',
        is_healthy = 0,
        updated_at = ?1
      WHERE id = ?2
    `)
    .bind(Date.now(), nodeId)
    .run();

  const metrics = getCircuitBreakerMetrics(nodeId);
  metrics.state = 'OPEN';
  metrics.lastStateChangeAt = Date.now();

  const executionDurationMs = Date.now() - startTime;

  return logHealingIncident(db, {
    nodeId,
    targetRegion: node.region,
    healingAction: 'degraded_node_isolation',
    triggerReason: reason,
    severity: 'high',
    previousState,
    remediatedState: 'isolated',
    failoverTargetNodeId: failoverNode ? failoverNode.id : null,
    executionDurationMs,
    automatedRecovery: true,
    status: 'executed',
    metadata: {
      failoverNodeId: failoverNode?.id ?? null,
      failoverRegion: failoverNode?.region ?? null,
    },
  });
}

/**
 * Executes a full self-healing evaluation sweep across all active nodes.
 */
export async function runSelfHealingSweep(
  db: D1Database
): Promise<{ evaluatedNodes: number; incidentsCreated: number; reroutesExecuted: number }> {
  const { results } = await db
    .prepare('SELECT * FROM autonomous_swarm_nodes')
    .all<AutonomousSwarmNodeRow>();

  if (!results || results.length === 0) {
    return { evaluatedNodes: 0, incidentsCreated: 0, reroutesExecuted: 0 };
  }

  const nodes = results.map(mapRowToSwarmNode);
  let incidentsCreated = 0;
  let reroutesExecuted = 0;

  for (const node of nodes) {
    const circuit = getCircuitBreakerMetrics(node.id);

    // Condition 1: Circuit tripped OPEN
    if (circuit.state === 'OPEN' && node.status !== 'isolated') {
      const failover = await findOptimalFailoverNode(db, node);
      await logHealingIncident(db, {
        nodeId: node.id,
        targetRegion: node.region,
        healingAction: 'route_reroute',
        triggerReason: `Circuit breaker tripped OPEN (${circuit.consecutiveFailures} failures)`,
        severity: 'high',
        previousState: node.status,
        remediatedState: 'rerouted',
        failoverTargetNodeId: failover ? failover.id : null,
        status: 'executed',
      });
      incidentsCreated++;
      reroutesExecuted++;
    }

    // Condition 2: Extreme CPU / Memory load anomaly (>95%)
    if (node.status === 'active' && (node.cpuLoadPct >= 95.0 || node.memoryLoadPct >= 95.0)) {
      await isolateNode(
        db,
        node.id,
        `Node resource exhaustion: CPU=${node.cpuLoadPct}%, Mem=${node.memoryLoadPct}%`
      );
      incidentsCreated++;
    }
  }

  logger.info('[self-healing-arbiter] Sweep completed', {
    evaluatedNodes: nodes.length,
    incidentsCreated,
    reroutesExecuted,
  });

  return {
    evaluatedNodes: nodes.length,
    incidentsCreated,
    reroutesExecuted,
  };
}
