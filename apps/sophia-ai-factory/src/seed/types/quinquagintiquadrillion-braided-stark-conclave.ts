/**
 * @file quinquagintiquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 37: 536,870,912-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type QuinquagintiquadrillionBraidedStarkProtocol =
  | 'QUINQUAGINTIQUADRILLION_NON_ARCHIMEDEAN_536870912'
  | 'QUINQUAGINTIQUADRILLION_BRAIDED_LATTICE_536870912';

export interface QuinquagintiquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface QuinquagintiquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 20,000,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 536,870,912
  verificationTimeNanos: number; // Sub-5 ns (target 2 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignQuinquagintiquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignQuinquagintiquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignQuinquagintiquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.99999999999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.999999999% stake slashing
  executedRemedyCents: number;
  verdict: SovereignQuinquagintiquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface QuinquagintiquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
