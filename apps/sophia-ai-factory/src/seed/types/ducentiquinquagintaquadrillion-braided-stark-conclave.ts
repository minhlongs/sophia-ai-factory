/**
 * @file ducentiquinquagintaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 42: 17,179,869,184-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type DucentiquinquagintaquadrillionBraidedStarkProtocol =
  | 'DUCENTIQUINQUAGINTAQUADRILLION_NON_ARCHIMEDEAN_17179869184'
  | 'DUCENTIQUINQUAGINTAQUADRILLION_BRAIDED_LATTICE_17179869184';

export interface DucentiquinquagintaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface DucentiquinquagintaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 1,000,000,000,000,000 transactions (1 Quadrillion)
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 17,179,869,184
  verificationTimeNanos: number; // Sub-1.5 ns (target 0.3 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignDucentiquinquagintaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignDucentiquinquagintaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignDucentiquinquagintaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.9999999999999999999% (19 nines)
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.999999999999% stake slashing (12 nines)
  executedRemedyCents: number;
  verdict: SovereignDucentiquinquagintaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface DucentiquinquagintaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
