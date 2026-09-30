/**
 * @file pentaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 34: 67,108,864-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type PentaquadrillionBraidedStarkProtocol =
  | 'PENTAQUADRILLION_NON_ARCHIMEDEAN_67108864'
  | 'PENTAQUADRILLION_BRAIDED_LATTICE_67108864';

export interface PentaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface PentaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 2,000,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 67,108,864
  verificationTimeNanos: number; // Sub-10 ns (target 5 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignPentaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignPentaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignPentaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.99999999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.9999999% stake slashing
  executedRemedyCents: number;
  verdict: SovereignPentaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface PentaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
