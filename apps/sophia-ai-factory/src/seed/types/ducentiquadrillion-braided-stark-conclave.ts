/**
 * @file ducentiquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 39: 2,147,483,648-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type DucentiquadrillionBraidedStarkProtocol =
  | 'DUCENTIQUADRILLION_NON_ARCHIMEDEAN_2147483648'
  | 'DUCENTIQUADRILLION_BRAIDED_LATTICE_2147483648';

export interface DucentiquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface DucentiquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 100,000,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 2,147,483,648
  verificationTimeNanos: number; // Sub-3 ns (target 1.0 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignDucentiquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignDucentiquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignDucentiquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.9999999999999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.999999999% stake slashing
  executedRemedyCents: number;
  verdict: SovereignDucentiquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface DucentiquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
