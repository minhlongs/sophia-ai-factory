/**
 * @file vigintiquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 36: 268,435,456-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type VigintiquadrillionBraidedStarkProtocol =
  | 'VIGINTIQUADRILLION_NON_ARCHIMEDEAN_268435456'
  | 'VIGINTIQUADRILLION_BRAIDED_LATTICE_268435456';

export interface VigintiquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface VigintiquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 8,000,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 268,435,456
  verificationTimeNanos: number; // Sub-6 ns (target 3 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignVigintiquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignVigintiquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignVigintiquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.9999999999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.999999999% stake slashing
  executedRemedyCents: number;
  verdict: SovereignVigintiquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface VigintiquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
