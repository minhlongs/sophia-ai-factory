/**
 * @file milliaquadrillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 44: 68,719,476,736-Bit Non-Archimedean Braided STARK & Sovereign Conclave.
 */

export type MilliaquadrillionBraidedStarkProtocol =
  | 'MILLIAQUADRILLION_NON_ARCHIMEDEAN_68719476736'
  | 'MILLIAQUADRILLION_BRAIDED_LATTICE_68719476736';

export interface MilliaquadrillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface MilliaquadrillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 4,000,000,000,000,000 transactions (4 Quadrillion)
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 68,719,476,736
  verificationTimeNanos: number; // Sub-0.8 ns (target 0.1 ns)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface SovereignMilliaquadrillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type SovereignMilliaquadrillionConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignMilliaquadrillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.999999999999999999999% (21 nines)
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.99999999999999% stake slashing (14 nines)
  executedRemedyCents: number;
  verdict: SovereignMilliaquadrillionConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface MilliaquadrillionEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
