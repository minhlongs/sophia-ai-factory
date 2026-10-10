/**
 * Swarm 2.0 Mesh Consensus Types, Constants & Hash Utilities
 *
 * @module tree/swarm/mesh/types
 */

import type { PbftMessage } from '@/seed/types/multi-asset-clearing';

export const CANONICAL_CONSENSUS_STATE_ID = 'state_mesh_v2_global';

/**
 * Calculates Byzantine fault tolerance limit f and quorum size Q.
 * N >= 3f + 1 => f = floor((N - 1) / 3), Quorum Q = 2f + 1
 */
export function calculateByzantineQuorum(clusterSize: number): {
  byzantineToleranceF: number;
  quorumSize: number;
} {
  const n = Math.max(1, clusterSize);
  const f = Math.floor((n - 1) / 3);
  const quorumSize = 2 * f + 1;
  return { byzantineToleranceF: f, quorumSize };
}

/**
 * Computes SHA-256 digest for PBFT proposals and tamper-evident audit state chaining.
 */
export async function computeConsensusHash(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(payload);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Constructs a structured PBFT message.
 */
export function buildPbftMessage(
  phase: 'PRE_PREPARE' | 'PREPARE' | 'COMMIT',
  viewNumber: number,
  sequenceNumber: number,
  proposalDigest: string,
  senderNodeId: string,
  signature: string
): PbftMessage {
  return {
    phase,
    viewNumber,
    sequenceNumber,
    proposalDigest,
    senderNodeId,
    signature,
    timestamp: Date.now(),
  };
}
