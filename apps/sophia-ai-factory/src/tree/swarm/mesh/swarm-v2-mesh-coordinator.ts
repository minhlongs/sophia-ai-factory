/**
 * Distributed Swarm 2.0 Raft-BFT Consensus Mesh Coordinator
 *
 * @module tree/swarm/mesh/swarm-v2-mesh-coordinator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmV2ConsensusState,
  SwarmV2ConsensusStateRow,
} from '@/seed/types/multi-asset-clearing';
import { rowToSwarmV2ConsensusState } from '@/seed/types/multi-asset-clearing';
import { logger } from '@/seed/utils/logger-utility';
import { CANONICAL_CONSENSUS_STATE_ID } from './types';

/**
 * Fetches the active Swarm v2 consensus state from D1.
 */
export async function getSwarmV2State(
  db: D1Database,
  stateId: string = CANONICAL_CONSENSUS_STATE_ID
): Promise<SwarmV2ConsensusState | null> {
  const row = await db
    .prepare('SELECT * FROM swarm_v2_consensus_state WHERE id = ?')
    .bind(stateId)
    .first<SwarmV2ConsensusStateRow>();

  return row ? rowToSwarmV2ConsensusState(row) : null;
}

/**
 * Elects a new leader for Swarm v2 Raft-BFT cluster and increments election term.
 */
export async function electSwarmV2Leader(
  db: D1Database,
  candidateNodeId: string,
  stateId: string = CANONICAL_CONSENSUS_STATE_ID
): Promise<SwarmV2ConsensusState> {
  const currentState = await getSwarmV2State(db, stateId);
  if (!currentState) {
    throw new Error(`CONSENSUS_STATE_NOT_FOUND: ${stateId}`);
  }

  const now = Date.now();
  const nextTerm = currentState.term + 1;

  await db
    .prepare(
      `UPDATE swarm_v2_consensus_state
       SET term = ?,
           leader_node_id = ?,
           last_leader_election_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(nextTerm, candidateNodeId, now, now, stateId)
    .run();

  logger.info('Swarm v2 leader elected', {
    stateId,
    electedLeader: candidateNodeId,
    term: nextTerm,
  });

  const updatedState = await getSwarmV2State(db, stateId);
  if (!updatedState) {
    throw new Error('FAILED_TO_LOAD_UPDATED_STATE');
  }

  return updatedState;
}
