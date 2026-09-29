/**
 * @file omni-dimensional-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 27: 524,288-Bit Non-Archimedean Omni-Dimensional STARK & Omni-Dimensional Supreme Conclave.
 */

export type OmniDimensionalStarkProtocol =
  | 'OMNI_DIMENSIONAL_NON_ARCHIMEDEAN_524288'
  | 'OMNI_HOLOGRAPHIC_FRACTAL_LATTICE_524288';

export interface OmniDimensionalTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface OmniDimensionalStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 10,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 524,288
  verificationTimeMicros: number; // Sub-1 µs (target 500 ns = 0.5 µs)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface OmniDimensionalJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type OmniDimensionalConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface OmniDimensionalConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.9999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.9% stake slashing
  executedRemedyCents: number;
  verdict: OmniDimensionalConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface OmniDimensionalConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
