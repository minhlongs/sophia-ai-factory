/**
 * @file quingentiquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 43: 34,359,738,368-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type QuingentiquadrillionBraidedStarkProtocol =
  | 'QUINGENTIQUADRILLION_NON_ARCHIMEDEAN_34359738368'
  | 'QUINGENTIQUADRILLION_BRAIDED_LATTICE_34359738368';

export interface QuingentiquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface QuingentiquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 2,000,000,000,000,000 transactions (2 Quadrillion)
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 34,359,738,368
  verificationTimeNanos: number; // Sub-1.0 ns (target 0.2 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignQuingentiquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignQuingentiquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignQuingentiquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.99999999999999999999% (20 nines)
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.9999999999999% stake slashing (13 nines)
  executedRemedyCents: number;
  verdict: SovereignQuingentiquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface QuingentiquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
