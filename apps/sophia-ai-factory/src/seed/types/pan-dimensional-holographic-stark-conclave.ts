/**
 * @file pan-dimensional-holographic-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 29: 2,097,152-Bit Non-Archimedean Pan-Dimensional Holographic STARK & Pan-Dimensional Supreme Conclave.
 */

export type PanDimensionalHolographicStarkProtocol =
  | 'PAN_DIMENSIONAL_NON_ARCHIMEDEAN_2097152'
  | 'TRANS_COSMIC_HOLOGRAPHIC_LATTICE_2097152';

export interface PanDimensionalEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface PanDimensionalHolographicStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 40,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 2,097,152
  verificationTimeNanos: number; // Sub-250 ns (target 125 ns = 0.125 µs)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface PanDimensionalEmpireJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type PanDimensionalSupremeConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface PanDimensionalSupremeConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.99% stake slashing
  executedRemedyCents: number;
  verdict: PanDimensionalSupremeConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface PanDimensionalEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
