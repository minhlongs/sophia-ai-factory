/**
 * @file sovereign-conclave-domain-engine.ts
 * @layer tree/governance
 * @description Canonical parameterized domain engine for Sovereign Conclave Arbitration & Constitutional Invariant Verification.
 */

import { createHash } from 'node:crypto';

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

function resolveSlashingMultiplier(config: ConclaveArbitrationConfig, slashingPenaltyPct: number): number {
  if (config.slashingMultiplier !== undefined) {
    return config.slashingMultiplier;
  }
  return slashingPenaltyPct <= 1.0 ? slashingPenaltyPct : slashingPenaltyPct / 100;
}

function createEmptyConclaveRuling(
  input: ConclaveDisputeInput,
  config: ConclaveArbitrationConfig
): ConclaveDisputeRuling {
  const verdict = config.emptyVerdict ?? 'PENDING_EVIDENCE';
  const rulingHash = config.emptyRulingHashFn
    ? config.emptyRulingHashFn(input)
    : createHash('sha256').update(config.emptyHashTag ?? 'NO_VOTES').digest('hex');
  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict,
    totalJurors: 0,
    totalSenators: 0,
    totalDirectors: 0,
    claimantVotes: 0,
    respondentVotes: 0,
    effectiveSupermajorityPct: 0,
    achievedSupermajorityPct: 0,
    jurorsSlashedCount: 0,
    senatorsSlashedCount: 0,
    directorsSlashedCount: 0,
    totalSlashedStakeCents: 0,
    executedRemedyCents: 0,
    rulingHash,
  };
}

function tallyConclaveVotes(votes: ConclaveJurorVote[]): { claimantVotes: number; respondentVotes: number } {
  let claimantVotes = 0;
  let respondentVotes = 0;
  for (const v of votes) {
    if (v.voteForClaimant) {
      claimantVotes++;
    } else {
      respondentVotes++;
    }
  }
  return { claimantVotes, respondentVotes };
}

function calculateConclaveSlashing(
  votes: ConclaveJurorVote[],
  slashDissentersOfClaimant: boolean,
  multiplier: number
): { jurorsSlashedCount: number; totalSlashedStakeCents: number } {
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  for (const v of votes) {
    const shouldSlash = slashDissentersOfClaimant ? !v.voteForClaimant : v.voteForClaimant;
    if (shouldSlash) {
      jurorsSlashedCount++;
      totalSlashedStakeCents += Math.floor(v.stakeCents * multiplier);
    }
  }
  return { jurorsSlashedCount, totalSlashedStakeCents };
}

function evaluateConclaveOutcome(
  input: ConclaveDisputeInput,
  claimantPct: number,
  respondentPct: number,
  thresholdPct: number,
  precision: number,
  slashingMultiplier: number
): {
  verdict: string;
  effectiveSupermajorityPct: number;
  executedRemedyCents: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
} {
  if (claimantPct >= thresholdPct) {
    const slashing = calculateConclaveSlashing(input.votes, true, slashingMultiplier);
    return {
      verdict: 'CLAIMANT_PREVAILS',
      effectiveSupermajorityPct: Number(claimantPct.toFixed(precision)),
      executedRemedyCents: input.disputeValueCents,
      ...slashing,
    };
  }
  if (respondentPct >= thresholdPct) {
    const slashing = calculateConclaveSlashing(input.votes, false, slashingMultiplier);
    return {
      verdict: 'RESPONDENT_PREVAILS',
      effectiveSupermajorityPct: Number(respondentPct.toFixed(precision)),
      executedRemedyCents: 0,
      ...slashing,
    };
  }
  return {
    verdict: 'DELIBERATING',
    effectiveSupermajorityPct: Number(Math.max(claimantPct, respondentPct).toFixed(precision)),
    executedRemedyCents: 0,
    jurorsSlashedCount: 0,
    totalSlashedStakeCents: 0,
  };
}

function computeConclaveRulingHash(
  input: ConclaveDisputeInput,
  rulingContext: ConclaveRulingContext,
  config: ConclaveArbitrationConfig
): string {
  if (config.rulingHashFn) {
    return config.rulingHashFn(rulingContext);
  }
  const prefix = config.hashPrefix ?? 'CONCLAVE_RULING';
  return createHash('sha256')
    .update(`${prefix}:${input.disputeCaseRef}:${rulingContext.verdict}:${rulingContext.executedRemedyCents}:${rulingContext.totalSlashedStakeCents}`)
    .digest('hex');
}

/**
 * Parameterized dispute arbitration for Conclave, Tribunal, Senate, and Court engines.
 */
export function arbitrateParameterizedConclaveDispute(
  input: ConclaveDisputeInput,
  config: ConclaveArbitrationConfig = {}
): ConclaveDisputeRuling {
  const thresholdPct =
    input.supermajorityThresholdPct ?? config.defaultSupermajorityThresholdPct ?? 98.0;
  const slashingPenaltyPct = config.slashingPenaltyPct ?? 60.0;
  const slashingMultiplier = resolveSlashingMultiplier(config, slashingPenaltyPct);
  const totalJurors = input.votes.length;

  if (totalJurors === 0) {
    return createEmptyConclaveRuling(input, config);
  }

  const { claimantVotes, respondentVotes } = tallyConclaveVotes(input.votes);
  const claimantPct = (claimantVotes / totalJurors) * 100;
  const respondentPct = (respondentVotes / totalJurors) * 100;

  const precision = Math.max(
    2,
    thresholdPct.toString().includes('.') ? (thresholdPct.toString().split('.')[1]?.length ?? 2) : 2
  );

  const outcome = evaluateConclaveOutcome(
    input,
    claimantPct,
    respondentPct,
    thresholdPct,
    precision,
    slashingMultiplier
  );

  const rulingContext: ConclaveRulingContext = {
    disputeCaseRef: input.disputeCaseRef,
    verdict: outcome.verdict,
    totalJurors,
    claimantVotes,
    respondentVotes,
    effectiveSupermajorityPct: outcome.effectiveSupermajorityPct,
    jurorsSlashedCount: outcome.jurorsSlashedCount,
    totalSlashedStakeCents: outcome.totalSlashedStakeCents,
    executedRemedyCents: outcome.executedRemedyCents,
    thresholdPct,
    slashingPenaltyPct,
  };

  const rulingHash = computeConclaveRulingHash(input, rulingContext, config);

  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict: outcome.verdict,
    totalJurors,
    totalSenators: totalJurors,
    totalDirectors: totalJurors,
    claimantVotes,
    respondentVotes,
    effectiveSupermajorityPct: outcome.effectiveSupermajorityPct,
    achievedSupermajorityPct: outcome.effectiveSupermajorityPct,
    jurorsSlashedCount: outcome.jurorsSlashedCount,
    senatorsSlashedCount: outcome.jurorsSlashedCount,
    directorsSlashedCount: outcome.jurorsSlashedCount,
    totalSlashedStakeCents: outcome.totalSlashedStakeCents,
    executedRemedyCents: outcome.executedRemedyCents,
    rulingHash,
  };
}

/**
 * Validates proposed actions or article mutations against constitutional invariants.
 */
export function verifyParameterizedConstitutionalInvariants(
  invariants: ConstitutionalInvariantItem[],
  proposedTargetArticleCode: string,
  actionCode?: string,
  config: { hashPrefix?: string } = {}
): InvariantCheckResult {
  const match = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (!match) {
    const hash = createHash('sha256')
      .update(`INVARIANT_NOT_FOUND:${proposedTargetArticleCode}`)
      .digest('hex');
    return {
      allowed: true,
      articleCode: proposedTargetArticleCode,
      isStrictlyImmutable: false,
      reason: 'Article not found in constitutional invariants charter; standard modification procedure applies',
      verificationHash: hash,
    };
  }

  const prefix = config.hashPrefix ?? 'CONSTITUTIONAL_INVARIANT';
  const hash = createHash('sha256')
    .update(`${prefix}:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash ?? ''}`)
    .digest('hex');

  // If checking an action like 'OVERRIDE'
  if (actionCode && match.isStrictlyImmutable && actionCode.includes('OVERRIDE')) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Action ${actionCode} violates strictly immutable constitutional invariant ${match.articleCode}`,
      verificationHash: hash,
    };
  }

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Constitutional Invariant ${match.articleCode} ("${match.articleTitle ?? ''}"): Strictly Immutable`,
      verificationHash: hash,
    };
  }

  return {
    allowed: true,
    articleCode: match.articleCode,
    isStrictlyImmutable: false,
    verificationHash: hash,
  };
}
