/**
 * quantum-dao.ts — Gate 12 Milestone Seed Types
 * Pillar 2: Quantum-Resistant ZK Lattice Proof Mesh & Sovereign AI DAO Governance
 *
 * Target: NIST FIPS 203 ML-KEM & FIPS 204 ML-DSA Lattice Cryptography & Supermajority DAO Governance
 */

export const QUANTUM_DAO_CONSTANTS = {
  DEFAULT_SECURITY_CATEGORY: 5, // NIST Category 5 (AES-256 equivalent)
  DEFAULT_KYBER_PARAMS_BYTES: 1568, // ML-KEM-1024 public key size
  DAO_QUORUM_THRESHOLD_TOKENS: 50_000_000, // 50M tokens
  DAO_APPROVAL_SUPERMAJORITY_BPS: 6667, // 66.67%
  DEFAULT_TIMELOCK_SECONDS: 86_400, // 24 hours
} as const;

export type QuantumAlgorithm = 'ML_KEM_1024' | 'ML_DSA_87' | 'HYBRID_KYBER_ED25519' | 'FALCON_1024';

export interface QuantumIdentityKey {
  id: string;
  agentDid: string;
  algorithm: QuantumAlgorithm;
  publicKeyHex: string;
  keyEncapsulationParameterBytes: number;
  securityCategory: number;
  isRevoked: boolean;
  activatedAt: string;
  expiresAt: string;
}

export interface LatticeProofVerification {
  id: string;
  keyId: string;
  challengeNonceHex: string;
  sharedSecretHashHex: string;
  signatureHex: string;
  verificationLatencyMs: number;
  isVerified: boolean;
  verifiedAt: string;
}

export type DaoProposalCategory =
  | 'TREASURY_ALLOCATION'
  | 'ALGORITHM_UPGRADE'
  | 'FEE_STRUCTURE'
  | 'EMERGENCY_CIRCUIT_BREAKER'
  | 'GLOBAL_EXPANSION';

export type DaoProposalStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PASSED'
  | 'REJECTED'
  | 'QUEUED'
  | 'EXECUTED'
  | 'CANCELLED';

export interface SovereignDaoProposal {
  id: string;
  proposalNumber: number;
  title: string;
  descriptionCid: string;
  proposerDid: string;
  category: DaoProposalCategory;
  quorumThresholdTokens: number;
  approvalThresholdBps: number;
  totalVotesCast: number;
  yesVotesCast: number;
  noVotesCast: number;
  abstainVotesCast: number;
  executionTimelockSeconds: number;
  status: DaoProposalStatus;
  votingStartsAt: string;
  votingEndsAt: string;
  executedAt: string | null;
  createdAt: string;
}

export type DaoVoteChoice = 'YES' | 'NO' | 'ABSTAIN';

export interface DaoVoteReceipt {
  id: string;
  proposalId: string;
  voterDid: string;
  votingPowerWeight: number;
  voteChoice: DaoVoteChoice;
  quantumSignatureHex: string;
  merkleLeafHash: string;
  castedAt: string;
}
