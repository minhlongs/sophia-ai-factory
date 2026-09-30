/**
 * @file quadrillion-holographic-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 32: 16,777,216-Bit Non-Archimedean Quadrillion Holographic STARK & Sovereign Conclave.
 */

export type QuadrillionHolographicStarkProtocol =
  | 'QUADRILLION_NON_ARCHIMEDEAN_16777216'
  | 'TRANS_COSMIC_HOLOGRAPHIC_LATTICE_16777216';

export interface QuadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface QuadrillionHolographicStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 400,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 16,777,216
  verificationTimeNanos: number; // Sub-15 ns (target 10 ns = 0.01 µs)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignQuadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignQuadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignQuadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.999999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.99999% stake slashing
  executedRemedyCents: number;
  verdict: SovereignQuadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface QuadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
