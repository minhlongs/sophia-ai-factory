/**
 * @file centummilliaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 41: 8,589,934,592-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type CentummilliaquadrillionBraidedStarkProtocol =
  | 'CENTUMMILLIAQUADRILLION_NON_ARCHIMEDEAN_8589934592'
  | 'CENTUMMILLIAQUADRILLION_BRAIDED_LATTICE_8589934592';

export interface CentummilliaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface CentummilliaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 400,000,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 8,589,934,592
  verificationTimeNanos: number; // Sub-2.0 ns (target 0.5 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignCentummilliaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignCentummilliaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignCentummilliaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.999999999999999999% (18 nines)
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.99999999999% stake slashing
  executedRemedyCents: number;
  verdict: SovereignCentummilliaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface CentummilliaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
