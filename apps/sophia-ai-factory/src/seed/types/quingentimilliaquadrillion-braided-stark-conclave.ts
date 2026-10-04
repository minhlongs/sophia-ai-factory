/**
 * @file quingentimilliaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 46: 274,877,906,944-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type QuingentimilliaquadrillionBraidedStarkProtocol =
  | 'QUINGENTIMILLIAQUADRILLION_NON_ARCHIMEDEAN_274877906944'
  | 'QUINGENTIMILLIAQUADRILLION_BRAIDED_LATTICE_274877906944';

export interface QuingentimilliaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface QuingentimilliaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 20,000,000,000,000,000 transactions (20 Quadrillion)
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 274,877,906,944
  verificationTimeNanos: number; // Sub-0.3 ns (target 0.08 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignQuingentimilliaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignQuingentimilliaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignQuingentimilliaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.99999999999999999999999% (23 nines)
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.9999999999999999% stake slashing (16 nines)
  executedRemedyCents: number;
  verdict: SovereignQuingentimilliaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface QuingentimilliaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
