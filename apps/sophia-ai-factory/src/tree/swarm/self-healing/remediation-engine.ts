/**
 * Failover Node Selection, Node Isolation, and Sweeping
 *
 * @module tree/swarm/self-healing/remediation-engine
 */

import type { D1Database } from '@/seed/db/client';
import type { AutonomousSwarmNodeRow } from '@/seed/types/autonomous-swarm';
import { mapRowToSwarmNode } from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { getCircuitBreakerMetrics } from './circuit-breaker';
import { logHealingIncident } from './incident-logger';
import {
  findOptimalFailoverNode,
  isolateNode,
} from './remediation-strategies';

export { findOptimalFailoverNode, isolateNode };

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
