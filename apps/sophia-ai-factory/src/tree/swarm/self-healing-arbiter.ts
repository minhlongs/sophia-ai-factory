/**
 * Edge Self-Healing Arbiter & Autonomous Circuit Breaker Engine
 *
 * Layer: tree/swarm (Domain services & pure algorithms)
 * Dependencies: @/seed/types/autonomous-swarm, @/seed/db/client, @/seed/utils/logger-utility
 *
 * Implements:
 * - 3-state finite circuit breaker (CLOSED, OPEN, HALF_OPEN)
 * - Autonomous failure trip detection with error rate & consecutive thresholds
 * - Dynamic route rerouting across Anycast regions (APAC -> US -> EU -> Global)
 * - Degraded node quarantine & isolation
 * - Persistent audit logging into edge_healing_incidents table in D1
 * - Automatic probe recovery and cooldown arbitration
 *
 * @module tree/swarm/self-healing-arbiter
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmNode,
  AutonomousSwarmNodeRow,
  EdgeHealingIncident,
  EdgeHealingIncidentRow,
  EdgeHealingAction,
  HealingIncidentSeverity,
  HealingIncidentStatus,
  CircuitBreakerMetrics,
  CircuitBreakerConfig,
  SwarmRegion,
} from '@/seed/types/autonomous-swarm';
import {
  mapRowToSwarmNode,
  mapRowToHealingIncident,
} from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3, // Trip after 3 consecutive failures
  cooldownPeriodMs: 30_000, // 30s before testing with HALF_OPEN
  probeSuccessThreshold: 1, // 1 successful probe to reset to CLOSED
};

// In-memory circuit state cache per edge node
const nodeCircuitStates = new Map<string, CircuitBreakerMetrics>();

/**
 * Resets or clears circuit breaker state for a node (e.g. for testing).
 */
export function resetCircuit(nodeId: string): void {
  nodeCircuitStates.delete(nodeId);
}

/**
 * Clears all in-memory circuit breaker states (test isolation).
 */
export function resetAllCircuits(): void {
  nodeCircuitStates.clear();
}

/**
 * Gets or initializes the circuit breaker metrics for a node.
 * Evaluates cooldown transition from OPEN -> HALF_OPEN automatically.
 */
export function getCircuitBreakerMetrics(
  nodeId: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  now: number = Date.now()
): CircuitBreakerMetrics {
  let metrics = nodeCircuitStates.get(nodeId);
  if (!metrics) {
    metrics = {
      state: 'CLOSED',
      consecutiveFailures: 0,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastFailureAt: null,
      lastStateChangeAt: now,
    };
    nodeCircuitStates.set(nodeId, metrics);
    return metrics;
  }

  // Transition OPEN -> HALF_OPEN if cooldown period has elapsed
  if (metrics.state === 'OPEN' && now - metrics.lastStateChangeAt >= config.cooldownPeriodMs) {
    metrics.state = 'HALF_OPEN';
    metrics.lastStateChangeAt = now;
    logger.info('[self-healing-arbiter] Circuit transitioned OPEN -> HALF_OPEN', { nodeId });
  }

  return metrics;
}

/**
 * Records a successful operation through a node's circuit.
 * If circuit was HALF_OPEN, transitions to CLOSED.
 */
export function recordSuccess(
  nodeId: string,
  _config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  now: number = Date.now()
): CircuitBreakerMetrics {
  const metrics = getCircuitBreakerMetrics(nodeId, _config, now);
  metrics.totalCalls++;
  metrics.successfulCalls++;
  metrics.consecutiveFailures = 0;

  if (metrics.state === 'HALF_OPEN') {
    metrics.state = 'CLOSED';
    metrics.lastStateChangeAt = now;
    logger.info('[self-healing-arbiter] Circuit recovered HALF_OPEN -> CLOSED', { nodeId });
  }

  return metrics;
}

/**
 * Records a failed operation through a node's circuit.
 * Evaluates failure threshold to trip circuit into OPEN state.
 */
export function recordFailure(
  nodeId: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  now: number = Date.now()
): { tripped: boolean; metrics: CircuitBreakerMetrics } {
  const metrics = getCircuitBreakerMetrics(nodeId, config, now);
  metrics.totalCalls++;
  metrics.failedCalls++;
  metrics.consecutiveFailures++;
  metrics.lastFailureAt = now;

  let tripped = false;

  if (metrics.state === 'HALF_OPEN') {
    // Single failure in HALF_OPEN immediately trips back to OPEN
    metrics.state = 'OPEN';
    metrics.lastStateChangeAt = now;
    tripped = true;
    logger.warn('[self-healing-arbiter] Probe failed in HALF_OPEN, tripped to OPEN', { nodeId });
  } else if (metrics.state === 'CLOSED' && metrics.consecutiveFailures >= config.failureThreshold) {
    metrics.state = 'OPEN';
    metrics.lastStateChangeAt = now;
    tripped = true;
    logger.warn('[self-healing-arbiter] Failure threshold reached, tripped CLOSED -> OPEN', {
      nodeId,
      consecutiveFailures: metrics.consecutiveFailures,
    });
  }

  return { tripped, metrics };
}

/**
 * Logs a self-healing incident into the D1 audit table.
 */
export async function logHealingIncident(
  db: D1Database,
  input: {
    nodeId: string;
    targetRegion: SwarmRegion;
    healingAction: EdgeHealingAction;
    triggerReason: string;
    severity?: HealingIncidentSeverity;
    previousState: string;
    remediatedState: string;
    failoverTargetNodeId?: string | null;
    executionDurationMs?: number;
    automatedRecovery?: boolean;
    status?: HealingIncidentStatus;
    metadata?: Record<string, unknown>;
  }
): Promise<EdgeHealingIncident> {
  const now = Date.now();
  const id = `ehi_${Math.random().toString(16).slice(2, 10)}`;
  const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  const incidentCode = `INC-HEAL-${dateStr}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

  const severity = input.severity ?? 'medium';
  const status = input.status ?? 'executed';
  const automatedRecoveryNum = input.automatedRecovery === false ? 0 : 1;
  const metadataJson = JSON.stringify(input.metadata ?? {});

  await db
    .prepare(`
      INSERT INTO edge_healing_incidents (
        id, incident_code, node_id, target_region, healing_action,
        trigger_reason, severity, previous_state, remediated_state,
        failover_target_node_id, execution_duration_ms, automated_recovery,
        status, metadata_json, detected_at, recovered_at, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, NULL, ?16)
    `)
    .bind(
      id,
      incidentCode,
      input.nodeId,
      input.targetRegion,
      input.healingAction,
      input.triggerReason,
      severity,
      input.previousState,
      input.remediatedState,
      input.failoverTargetNodeId ?? null,
      input.executionDurationMs ?? 0,
      automatedRecoveryNum,
      status,
      metadataJson,
      now,
      now
    )
    .run();

  const incident: EdgeHealingIncident = {
    id,
    incidentCode,
    nodeId: input.nodeId,
    targetRegion: input.targetRegion,
    healingAction: input.healingAction,
    triggerReason: input.triggerReason,
    severity,
    previousState: input.previousState,
    remediatedState: input.remediatedState,
    failoverTargetNodeId: input.failoverTargetNodeId ?? null,
    executionDurationMs: input.executionDurationMs ?? 0,
    automatedRecovery: input.automatedRecovery !== false,
    status,
    metadata: input.metadata ?? {},
    detectedAt: now,
    recoveredAt: null,
    createdAt: now,
  };

  logger.info('[self-healing-arbiter] Incident logged', {
    incidentCode,
    nodeId: input.nodeId,
    action: input.healingAction,
  });

  return incident;
}

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

  // Find failover target
  const failoverNode = await findOptimalFailoverNode(db, node);

  // Update node in DB
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

  // Force circuit breaker to OPEN
  const metrics = getCircuitBreakerMetrics(nodeId);
  metrics.state = 'OPEN';
  metrics.lastStateChangeAt = Date.now();

  const executionDurationMs = Date.now() - startTime;

  const incident = await logHealingIncident(db, {
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

  return incident;
}

/**
 * Executes a full self-healing evaluation sweep across all active nodes.
 * Identifies nodes experiencing excessive load (>95%) or high error trip states.
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

/**
 * Resolves an existing edge healing incident.
 */
export async function resolveHealingIncident(
  db: D1Database,
  incidentId: string,
  resolutionNotes?: string
): Promise<{ success: boolean }> {
  const now = Date.now();
  const row = await db
    .prepare('SELECT metadata_json FROM edge_healing_incidents WHERE id = ?1 LIMIT 1')
    .bind(incidentId)
    .first<{ metadata_json: string }>();

  if (!row) {
    return { success: false };
  }

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata_json);
  } catch {
    metadata = {};
  }

  if (resolutionNotes) {
    metadata.resolutionNotes = resolutionNotes;
  }

  const result = await db
    .prepare(`
      UPDATE edge_healing_incidents
      SET
        status = 'recovered',
        recovered_at = ?1,
        metadata_json = ?2
      WHERE id = ?3
    `)
    .bind(now, JSON.stringify(metadata), incidentId)
    .run();

  const success = Boolean(result.meta.changes && result.meta.changes > 0);
  return { success };
}

/**
 * Queries edge healing incidents audit history.
 */
export async function queryHealingIncidents(
  db: D1Database,
  options?: { nodeId?: string; limit?: number; status?: HealingIncidentStatus }
): Promise<EdgeHealingIncident[]> {
  let query = 'SELECT * FROM edge_healing_incidents WHERE 1=1';
  const params: unknown[] = [];

  if (options?.nodeId) {
    params.push(options.nodeId);
    query += ` AND node_id = ?${params.length}`;
  }
  if (options?.status) {
    params.push(options.status);
    query += ` AND status = ?${params.length}`;
  }

  const limit = options?.limit ?? 50;
  params.push(limit);
  query += ` ORDER BY detected_at DESC LIMIT ?${params.length}`;

  const { results } = await db.prepare(query).bind(...params).all<EdgeHealingIncidentRow>();
  return (results ?? []).map(mapRowToHealingIncident);
}
