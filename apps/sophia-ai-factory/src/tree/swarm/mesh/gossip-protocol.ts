/**
 * Swarm 2.0 Sub-10ms Heartbeat Profiler & Gossip Telemetry
 *
 * @module tree/swarm/mesh/gossip-protocol
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmV2ConsensusState,
  SwarmV2ConsensusStateRow,
  HeartbeatTelemetryV2Input,
  ConsensusTelemetryResult,
} from '@/seed/types/multi-asset-clearing';
import {
  SUB_10MS_HEARTBEAT_THRESHOLD_MS,
  rowToSwarmV2ConsensusState,
} from '@/seed/types/multi-asset-clearing';
import { calculateByzantineQuorum, CANONICAL_CONSENSUS_STATE_ID } from './types';

/**
 * Ingests heartbeat telemetry from a cluster voter node.
 * Evaluates Exponential Moving Average (EMA) latency with alpha = 0.25.
 * Strictly verifies whether average latency remains sub-10ms.
 */
export function recordHeartbeat(
  state: SwarmV2ConsensusState,
  input: HeartbeatTelemetryV2Input
): ConsensusTelemetryResult {
  const rtt = Math.max(0.1, input.roundTripLatencyMs);

  // Exponential Moving Average: EMA_t = alpha * RTT + (1 - alpha) * EMA_{t-1}
  const alpha = 0.25;
  const prevAvg = state.avgHeartbeatLatencyMs > 0 ? state.avgHeartbeatLatencyMs : rtt;
  const newAvg = Math.round((alpha * rtt + (1 - alpha) * prevAvg) * 100) / 100;

  // Track p99 estimate: conservative upper bound tracking
  const newP99 = Math.round(Math.max(rtt * 1.25, newAvg * 1.5) * 100) / 100;

  const isSub10ms = newAvg < SUB_10MS_HEARTBEAT_THRESHOLD_MS;
  const { quorumSize } = calculateByzantineQuorum(state.activeVotersCount);
  const isQuorumHealthy = state.activeVotersCount >= quorumSize && newAvg < 15.0;

  return {
    acknowledged: true,
    term: state.term,
    leaderId: state.leaderNodeId,
    avgHeartbeatLatencyMs: newAvg,
    p99HeartbeatLatencyMs: newP99,
    isSub10ms,
    isQuorumHealthy,
    splitBrainDetected: state.splitBrainDetected,
  };
}

/**
 * Updates consensus state in D1 with incoming heartbeat telemetry.
 */
export async function updateSwarmV2Heartbeat(
  db: D1Database,
  input: HeartbeatTelemetryV2Input,
  stateId: string = CANONICAL_CONSENSUS_STATE_ID
): Promise<ConsensusTelemetryResult> {
  const row = await db
    .prepare('SELECT * FROM swarm_v2_consensus_state WHERE id = ?')
    .bind(stateId)
    .first<SwarmV2ConsensusStateRow>();

  if (!row) {
    throw new Error(`CONSENSUS_STATE_NOT_FOUND: ${stateId}`);
  }

  const currentState = rowToSwarmV2ConsensusState(row);
  const result = recordHeartbeat(currentState, input);
  const now = Date.now();

  await db
    .prepare(
      `UPDATE swarm_v2_consensus_state
       SET avg_heartbeat_latency_ms = ?,
           p99_heartbeat_latency_ms = ?,
           is_quorum_healthy = ?,
           last_heartbeat_round_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(
      result.avgHeartbeatLatencyMs,
      result.p99HeartbeatLatencyMs,
      result.isQuorumHealthy ? 1 : 0,
      now,
      now,
      stateId
    )
    .run();

  return result;
}
