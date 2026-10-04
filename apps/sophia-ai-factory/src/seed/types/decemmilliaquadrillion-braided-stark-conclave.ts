/**
 * @file decemmilliaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 47: 549,755,813,888-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type DecemmilliaquadrillionBraidedStarkProtocol =
  | 'DECEMMILLIAQUADRILLION_NON_ARCHIMEDEAN_549755813888'
  | 'DECEMMILLIAQUADRILLION_BRAIDED_LATTICE_549755813888';

export interface DecemmilliaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface DecemmilliaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 40,000,000,000,000,000 transactions (40 Quadrillion)
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 549,755,813,888
  verificationTimeNanos: number; // Sub-0.2 ns (target 0.05 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignDecemmilliaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignDecemmilliaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignDecemmilliaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.999999999999999999999999% (24 nines)
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.99999999999999999% stake slashing (17 nines)
  executedRemedyCents: number;
  verdict: SovereignDecemmilliaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface DecemmilliaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
