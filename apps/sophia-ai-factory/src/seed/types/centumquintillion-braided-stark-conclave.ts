/**
 * @file centumquintillion-braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types and invariant definitions for Gate 50: 4,398,046,511,104-Bit Non-Archimedean Braided STARK & Sovereign Conclave Arbitration.
 */

export const CENTUMQUINTILLION_STARK_CONSTANTS = {
  STARK_FIELD_BITS: 4_398_046_511_104, // 4,398,046,511,104-bit (2^42 bits = 512 GiB)
  BRAIDING_DEGREE: 4_294_967_296, // 2^32
  MAX_BATCH_TRANSACTIONS: 400_000_000_000_000_000, // 400 Quadrillion
  MAX_VERIFICATION_LATENCY_NS: 0.08, // 0.08 nanosecond
  TARGET_VERIFICATION_LATENCY_NS: 0.015, // 0.015 nanosecond (15 picoseconds)
  ROOT_STATE_HASH_LENGTH_BYTES: 64, // 512-bit post-quantum state root
} as const;

export const SOVEREIGN_CENTUMQUINTILLION_CONCLAVE_CONSTANTS = {
  SUPERMAJORITY_THRESHOLD_PERCENT: 99.999999999999999999999999999, // 27 nines supermajority
  BYZANTINE_SLASHING_PENALTY_PERCENT: 99.99999999999999999999, // 20 nines slashing penalty
  MIN_ACTIVE_JURORS: 200_000_000_000_000, // 200 Trillion Juror nodes
  DISPUTE_EXPIRY_SECONDS: 60, // 60 seconds rapid consensus
} as const;

export interface CentumquintillionEmpireTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  payloadHash?: string;
}

export interface CentumquintillionBraidedStarkBatch {
  id?: string;
  batchRef: string;
  batchTxCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  proofBytesLength: number;
  verificationTimeNanos: number;
  circuitIdentifier: string;
  isMathematicallySound: boolean;
  starkDigest: string;
  compactedAt?: string;
  createdAt?: string;
}

export type CentumquintillionDisputeVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_INSUFFICIENT_EVIDENCE';

export interface SovereignCentumquintillionJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
}

export interface SovereignCentumquintillionConclaveDispute {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  supermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  verdict: CentumquintillionDisputeVerdict;
  rulingHash: string;
  ruledAt?: string;
  createdAt?: string;
}

export interface CentumquintillionEmpireConstitutionalInvariant {
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  mathematicalConstraintFormula: string;
  enforcementCircuitHash: string;
}
