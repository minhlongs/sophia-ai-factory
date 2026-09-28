/**
 * @file topological-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 23: 32,768-Bit Non-Archimedean Topological Holographic STARK & Pan-Dimensional Supreme Conclave.
 */

export type TopologicalStarkProtocol =
  | 'TOPOLOGICAL_ANYONIC_32768'
  | 'TRANS_COSMIC_STARK_RECURSIVE'
  | 'PAN_DIMENSIONAL_STARK_V10';

export type TopologicalStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'TOPOLOGICALLY_BRAIDED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface TopologicalStarkSession {
  id?: string;
  sessionRef: string;
  starkProtocol: TopologicalStarkProtocol;
  braidingDepth: number; // e.g. 64
  leafProofCount: number; // 400,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: TopologicalStarkSessionStatus;
  isTopologicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type PanDimensionalConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface PanDimensionalJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export interface PanDimensionalConclaveArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  conclaveJurorCount: number;
  supermajorityThresholdPct: number; // Min 99.9%
  verdict: PanDimensionalConclaveVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface PanDimensionalConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt?: string;
}

export interface TopologicalTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  payloadHash?: string;
  multiverseTag?: string;
}

export interface TopologicalStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeMicros: number; // Sub-8 µs
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}

