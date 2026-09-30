/**
 * @file omniversal-holographic-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 30: 4,194,304-Bit Non-Archimedean Omniversal Holographic STARK & Omnipresent Supreme Conclave.
 */

export type OmniversalHolographicStarkProtocol =
  | 'OMNIVERSAL_NON_ARCHIMEDEAN_4194304'
  | 'METAVERSE_HOLOGRAPHIC_LATTICE_4194304';

export interface OmniversalEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface OmniversalHolographicStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 100,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 4,194,304
  verificationTimeNanos: number; // Sub-100 ns (target 50 ns = 0.05 µs)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface OmnipresentEmpireJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type OmnipresentSupremeConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface OmnipresentSupremeConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.9999999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.999% stake slashing
  executedRemedyCents: number;
  verdict: OmnipresentSupremeConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface OmnipresentEmpireConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
