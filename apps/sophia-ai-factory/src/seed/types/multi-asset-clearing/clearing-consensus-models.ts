/**
 * Multi-Asset Clearing Swarm Consensus & PBFT Models
 *
 * Layer: seed/types
 */

export interface SwarmNodeHealth {
  nodeId: string;
  region: 'apac' | 'us' | 'eu' | 'global';
  status: 'active' | 'degraded' | 'isolated' | 'draining' | 'offline';
  lastHeartbeatAt: number;
  avgLatencyMs: number;
  term: number;
  commitIndex: number;
}

export interface PartitionArbitrationResult {
  splitBrainDetected: boolean;
  majorityPartitionNodes: string[];
  minorityPartitionNodes: string[];
  isolatedNodes: string[];
  activeLeaderId: string | null;
  arbitrationAction: 'MAINTAIN_LEADER' | 'DEMOTE_AND_ISOLATE' | 'EMERGENCY_QUORUM_LOST';
}

export interface ConsensusCommitResult {
  committed: boolean;
  term: number;
  commitIndex: number;
  quorumSize: number;
  approvalsCollected: number;
  digest: string;
  auditStateHash: string;
}

export type PbftPhase = 'PRE_PREPARE' | 'PREPARE' | 'COMMIT';

export interface PbftMessage {
  phase: PbftPhase;
  viewNumber: number;
  sequenceNumber: number;
  proposalDigest: string;
  senderNodeId: string;
  signature: string;
  timestamp: number;
}
