/**
 * @file post-quantum-constitution.ts
 * @layer seed/types
 * @description Seed types for Gate 15: Post-Quantum zk-SNARK Verifiable Statehood & Autonomous Planetary Constitutional Court.
 */

export type PostQuantumStandard = 'PQ_FROST_SHMIDT' | 'DILITHIUM_THRESHOLD' | 'FALCON_AGGREGATE';

export type PqSessionStatus =
  | 'PARTICIPANT_REGISTRATION'
  | 'COMMITMENT_COLLECTION'
  | 'SIGNATURE_AGGREGATED'
  | 'VERIFIED_FINAL';

export interface PostQuantumZkSession {
  id: string;
  sessionRef: string;
  protocolStandard: PostQuantumStandard;
  thresholdK: number;
  totalPartiesN: number;
  polynomialDegree: number;
  publicGroupCommitment: string;
  sessionStatus: PqSessionStatus;
  isPostQuantumSecure: boolean;
  verifiedAt?: string;
  createdAt: string;
}

export type CourtVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface JurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
}

export interface PlanetaryCourtArbitration {
  id: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractMerkleRoot: string;
  evidenceSha256: string;
  jurorCount: number;
  supermajorityThresholdPct: number; // min 75.0%
  verdict: CourtVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt: string;
}

export interface ConstitutionalInvariant {
  id: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt: string;
}

export interface CompactedTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
}

export interface ZkStateCompactionProof {
  id: string;
  proofRef: string;
  batchTransactionCount: number; // 1,000,000 txs
  previousStateRoot: string;
  newStateRoot: string;
  snarkProofBytesLength: number;
  verificationTimeMicros: number;
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt: string;
}
