/**
 * @file planetary-court-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Planetary Constitutional Court & Invariant Verification.
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
  verifyParameterizedConstitutionalInvariants,
} from './sovereign-conclave-domain-engine';

import type {
  ConstitutionalInvariant,
  CourtVerdict,
  JurorVote,
} from '@/seed/types/post-quantum-constitution';

export interface PlanetaryDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: JurorVote[];
  supermajorityThresholdPct?: number; // default 75.0%
}

export interface PlanetaryCourtVerdictOutput {
  disputeCaseRef: string;
  verdict: CourtVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface ConstitutionalInvariantCheckOutput {
  allowed: boolean;
  violationReason?: string;
  verificationHash: string;
}

/**
 * Arbitrates decentralized commercial and treaty disputes with juror staking & slashing.
 */
export function arbitratePlanetaryDispute(input: PlanetaryDisputeInput): PlanetaryCourtVerdictOutput {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 75.0,
    slashingPenaltyPct: 25.0,
    slashingMultiplier: 0.25,
    emptyVerdict: 'DISMISSED_NO_JURISDICTION',
    emptyRulingHashFn: (input) => createHash('sha256').update(`DISMISSED_NO_JURORS:${input.disputeCaseRef}`).digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`DISMISSED_NO_JURORS:${ctx.disputeCaseRef}`)
        .digest('hex'),
  });

  return {
    disputeCaseRef: result.disputeCaseRef,
    verdict: result.verdict as unknown as string,
    totalJurors: result.totalJurors,
    totalSenators: result.totalSenators,
    totalDirectors: result.totalDirectors,
    claimantVotes: result.claimantVotes,
    respondentVotes: result.respondentVotes,
    effectiveSupermajorityPct: result.effectiveSupermajorityPct ?? 0,
    achievedSupermajorityPct: result.achievedSupermajorityPct ?? 0,
    jurorsSlashedCount: result.jurorsSlashedCount,
    senatorsSlashedCount: result.senatorsSlashedCount,
    directorsSlashedCount: result.directorsSlashedCount,
    totalSlashedStakeCents: result.totalSlashedStakeCents,
    executedRemedyCents: result.executedRemedyCents,
    rulingHash: result.rulingHash,
  } as unknown as PlanetaryCourtVerdictOutput;
}

/**
 * Validates proposed legislative or constitutional changes against immutable core invariants.
 */
export function verifyConstitutionalInvariants(
  invariants: ConstitutionalInvariant[],
  proposedTargetArticleCode: string
): ConstitutionalInvariantCheckOutput {
  const target = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (target && target.isStrictlyImmutable) {
    const verificationHash = createHash('sha256')
      .update(`PROHIBITED_CONSTITUTIONAL_MUTATION:${proposedTargetArticleCode}:${target.articleTitle}`)
      .digest('hex');

    return {
      allowed: false,
      violationReason: `Article ${proposedTargetArticleCode} (${target.articleTitle}) is strictly immutable and protected by planetary anti-takeover invariant`,
      verificationHash,
    };
  }

  const verificationHash = createHash('sha256')
    .update(`PERMITTED_CONSTITUTIONAL_DIFF:${proposedTargetArticleCode}`)
    .digest('hex');

  return {
    allowed: true,
    verificationHash,
  };
}
