/**
 * @file ducentiquinquagintamilliaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 45: 137,438,953,472-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type DucentiquinquagintamilliaquadrillionBraidedStarkProtocol =
  | 'DUCENTIQUINQUAGINTAMILLIAQUADRILLION_NON_ARCHIMEDEAN_137438953472'
  | 'DUCENTIQUINQUAGINTAMILLIAQUADRILLION_BRAIDED_LATTICE_137438953472';

export interface DucentiquinquagintamilliaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface DucentiquinquagintamilliaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 10,000,000,000,000,000 transactions (10 Quadrillion)
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 137,438,953,472
  verificationTimeNanos: number; // Sub-0.5 ns (target 0.1 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignDucentiquinquagintamilliaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignDucentiquinquagintamilliaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignDucentiquinquagintamilliaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.9999999999999999999999% (22 nines)
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.999999999999999% stake slashing (15 nines)
  executedRemedyCents: number;
  verdict: SovereignDucentiquinquagintamilliaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface DucentiquinquagintamilliaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
