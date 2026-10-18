/**
 * Swarm Coordinator Leader Fitness & Consensus Election
 *
 * @module tree/swarm/coordinator/leader-fitness
 */

import type { SwarmNode } from '@/seed/types/autonomous-swarm';
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
