/**
 * @file zk-mpc-constitution.ts
 * @layer seed/types
 * @description Seed types for Gate 14: Zero-Knowledge Multi-Party Computation (ZK-MPC) & Autonomous Sovereign Statehood.
 */

export type MpcProtocolType =
  | 'BGW_ACTIVE'
  | 'GMW_THRESHOLD'
  | 'FROST_SCHNORR'
  | 'SPDZ_HOMOMORPHIC';

export type MpcSessionState =
  | 'COMMITMENT_PHASE'
  | 'SECRET_SHARING'
  | 'ZERO_KNOWLEDGE_PROOF_VERIFY'
  | 'RECONSTRUCTED_READY'
  | 'ABORTED';

export interface ZkMpcThresholdSession {
  id: string;
  sessionId: string;
  protocolType: MpcProtocolType;
  totalParticipants: number;
  thresholdQuorum: number;
  sessionState: MpcSessionState;
  aggregatedPublicKeyHex: string;
  stateProofMerkleRoot: string;
  executionLatencyMs: number;
  createdAt: string;
}

export interface MpcShareCommitment {
  participantId: string;
  shareIndex: number;
  commitmentHashHex: string;
  zkProofPayload: string;
}

export type RatificationStatus =
  | 'PROPOSED'
  | 'FORMAL_AUDIT_PASS'
  | 'DELIBERATING'
  | 'RATIFIED_INTO_LAW'
  | 'VETOED_UNCONSTITUTIONAL';

export interface ConstitutionalAmendmentProposal {
  id: string;
  articleReference: string;
  title: string;
  proposedDiffJson: string;
  sponsoringSovereignEntity: string;
  supermajorityRequirementBps: number; // e.g. 7500 (75%)
  affirmativeVotingPowerWeight: number;
  dissentingVotingPowerWeight: number;
  formalVerificationPassed: boolean;
  antiTakeoverGuardrailIntact: boolean;
  ratificationStatus: RatificationStatus;
  timelockEnactmentAt: string;
  createdAt: string;
}

export type PactCategory =
  | 'NON_PROLIFERATION_OF_ROGUE_AI'
  | 'RECIPROCAL_EXTRADITION_OF_MALICIOUS_SUBROUTINES'
  | 'INTERSTELLAR_TRADE_ZONE'
  | 'CROSS_CORRIDOR_SWAP_TREATY';

export interface SovereignTreatyCompact {
  id: string;
  treatyUuid: string;
  signatoryNations: string[];
  pactCategory: PactCategory;
  mutualDefenseEscrowCents: number;
  treatySignatureMpcProof: string;
  isActive: boolean;
  ratifiedAt: string;
  createdAt: string;
}

export interface FormalVerificationTheorem {
  id: string;
  theoremIdentifier: string;
  domainScope: 'CONSTITUTIONAL_LAW' | 'ESCROW_SOLVENCY' | 'ZERO_KNOWLEDGE_SOUNDNESS' | 'QUANTUM_STATE_ENTANGLEMENT';
  proofAssistantEngine: 'LEAN_4' | 'COQ' | 'ISABELLE_HOL' | 'Z3_SMT';
  theoremStatementHash: string;
  qedVerified: boolean;
  verifiedByPeerNodesCount: number;
  createdAt: string;
}
