/**
 * @file vigintiquinquemilliaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 48: 1,099,511,627,776-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type VigintiquinquemilliaquadrillionBraidedStarkProtocol =
  | 'VIGINTIQUINQUEMILLIAQUADRILLION_NON_ARCHIMEDEAN_1099511627776'
  | 'VIGINTIQUINQUEMILLIAQUADRILLION_BRAIDED_LATTICE_1099511627776';

export interface VigintiquinquemilliaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface VigintiquinquemilliaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 100,000,000,000,000,000 transactions (100 Quadrillion)
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 1,099,511,627,776
  verificationTimeNanos: number; // Sub-0.15 ns (target 0.03 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignVigintiquinquemilliaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignVigintiquinquemilliaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignVigintiquinquemilliaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.9999999999999999999999999% (25 nines)
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.999999999999999999% stake slashing (18 nines)
  executedRemedyCents: number;
  verdict: SovereignVigintiquinquemilliaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface VigintiquinquemilliaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
