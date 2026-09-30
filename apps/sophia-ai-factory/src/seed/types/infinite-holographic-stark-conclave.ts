/**
 * @file infinite-holographic-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 31: 8,388,608-Bit Non-Archimedean Infinite Holographic STARK & Eternal Supreme Conclave.
 */

export type InfiniteHolographicStarkProtocol =
  | 'INFINITE_NON_ARCHIMEDEAN_8388608'
  | 'ETERNAL_HOLOGRAPHIC_LATTICE_8388608';

export interface InfiniteEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface InfiniteHolographicStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 200,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 8,388,608
  verificationTimeNanos: number; // Sub-50 ns (target 25 ns = 0.025 µs)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface EternalEmpireJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type EternalSupremeConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface EternalSupremeConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.99999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.9999% stake slashing
  executedRemedyCents: number;
  verdict: EternalSupremeConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface EternalEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
