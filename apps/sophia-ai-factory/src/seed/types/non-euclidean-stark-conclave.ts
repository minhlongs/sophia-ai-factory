/**
 * @file non-euclidean-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 21: 8192-Bit Non-Euclidean Anyonic Holographic STARK & Trans-Dimensional Conclave.
 */

export type NonEuclideanStarkProtocol =
  | 'NON_EUCLIDEAN_ANYONIC_8192'
  | 'CONTINUUM_STARK_RECURSIVE'
  | 'OMEGA_STARK_V8';

export type NonEuclideanStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'TOPOLOGICALLY_BRAIDED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface NonEuclideanStarkSession {
  id?: string;
  sessionRef: string;
  starkProtocol: NonEuclideanStarkProtocol;
  braidingDepth: number; // e.g. 16
  leafProofCount: number; // 100,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: NonEuclideanStarkSessionStatus;
  isTopologicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type TransDimensionalConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface TransDimensionalJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  dimensionId?: string;
  rationale?: string;
}

export interface TransDimensionalConclaveArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  conclaveJurorCount: number;
  supermajorityThresholdPct: number; // Min 99.0%
  verdict: TransDimensionalConclaveVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface TransDimensionalConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt?: string;
}

export interface ContinuumTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  payloadHash?: string;
  dimensionTag?: string;
}

export interface NonEuclideanStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number; // 100,000,000
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number; // 8192
  verificationTimeMicros: number; // Sub-15 µs (e.g. 14)
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}
