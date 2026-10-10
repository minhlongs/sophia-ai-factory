/**
 * Swarm Node Heartbeat Tracker & Leader Fitness
 *
 * @module tree/swarm/coordinator/heartbeat-tracker
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmNode,
  HeartbeatTelemetryInput,
} from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { DEFAULT_HEARTBEAT_TIMEOUT_MS } from './types';

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
