/**
 * @file inter-galactic-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 28: 1,048,576-Bit Non-Archimedean Omni-Cosmic Holographic STARK & Omni-Cosmic Supreme Conclave.
 */

export type InterGalacticStarkProtocol =
  | 'INTER_GALACTIC_NON_ARCHIMEDEAN_1048576'
  | 'OMNI_COSMIC_HOLOGRAPHIC_LATTICE_1048576';

export interface InterGalacticTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  multiverseTag?: string;
}

export interface InterGalacticStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number; // 20,000,000,000 transactions
  previousStateRoot: string; // 64 bytes (128 hex chars)
  newStateRoot: string; // 64 bytes (128 hex chars)
  proofBytesLength: number; // 1,048,576
  verificationTimeNanos: number; // Sub-500 ns (target 250 ns = 0.25 µs)
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export interface InterGalacticJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export type InterGalacticConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface InterGalacticConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number; // Threshold 99.99999%
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number; // 99.95% stake slashing
  executedRemedyCents: number;
  verdict: InterGalacticConclaveVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface InterGalacticConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
  createdAt?: string;
}
