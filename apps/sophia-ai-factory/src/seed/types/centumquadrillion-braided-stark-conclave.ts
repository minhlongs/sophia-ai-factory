/**
 * @file centumquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 38: 1,073,741,824-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type CentumquadrillionBraidedStarkProtocol =
  | 'CENTUMQUADRILLION_NON_ARCHIMEDEAN_1073741824'
  | 'CENTUMQUADRILLION_BRAIDED_LATTICE_1073741824';

export interface CentumquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface CentumquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 40,000,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 1,073,741,824
  verificationTimeNanos: number; // Sub-4 ns (target 1.5 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignCentumquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignCentumquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignCentumquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.999999999999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.999999999% stake slashing
  executedRemedyCents: number;
  verdict: SovereignCentumquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface CentumquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
