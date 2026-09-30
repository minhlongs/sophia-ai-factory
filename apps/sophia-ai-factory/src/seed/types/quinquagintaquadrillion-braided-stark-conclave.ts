/**
 * @file quinquagintaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 40: 4,294,967,296-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type QuinquagintaquadrillionBraidedStarkProtocol =
  | 'QUINQUAGINTAQUADRILLION_NON_ARCHIMEDEAN_4294967296'
  | 'QUINQUAGINTAQUADRILLION_BRAIDED_LATTICE_4294967296';

export interface QuinquagintaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface QuinquagintaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 200,000,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 4,294,967,296
  verificationTimeNanos: number; // Sub-2.5 ns (target 0.8 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignQuinquagintaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignQuinquagintaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignQuinquagintaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.99999999999999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.9999999999% stake slashing
  executedRemedyCents: number;
  verdict: SovereignQuinquagintaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface QuinquagintaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
