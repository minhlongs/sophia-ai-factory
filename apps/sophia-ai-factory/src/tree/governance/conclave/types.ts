/**
 * @file types.ts
 * @layer tree/governance/conclave
 * @description Types and interfaces for Sovereign Conclave Arbitration & Constitutional Invariant Verification.
 */

export interface ConclaveJurorVote {
  jurorId?: string;
  directorId?: string;
  voterId?: string;
  voteForClaimant: boolean;
  stakeCents: number;
}

export interface ConclaveDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: ConclaveJurorVote[];
  supermajorityThresholdPct?: number;
}

export interface ConclaveRulingContext {
  disputeCaseRef: string;
  verdict: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  thresholdPct: number;
  slashingPenaltyPct: number;
}

export interface ConclaveArbitrationConfig {
  defaultSupermajorityThresholdPct?: number;
  slashingPenaltyPct?: number;
  slashingMultiplier?: number;
  hashPrefix?: string;
  emptyHashTag?: string;
  emptyVerdict?: string;
  emptyRulingHashFn?: (input: ConclaveDisputeInput) => string;
  rulingHashFn?: (ctx: ConclaveRulingContext) => string;
}

export interface ConclaveDisputeRuling {
  disputeCaseRef: string;
  verdict: string;
  totalJurors: number;
  totalSenators?: number;
  totalDirectors?: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct?: number;
  achievedSupermajorityPct?: number;
  jurorsSlashedCount: number;
  senatorsSlashedCount?: number;
  directorsSlashedCount?: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface ConstitutionalInvariantItem {
  articleCode: string;
  articleTitle?: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash?: string;
  mathematicalConstraintFormula?: string;
  lastTheoremVerifiedAt?: string;
}

export interface InvariantCheckResult {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash?: string;
}
