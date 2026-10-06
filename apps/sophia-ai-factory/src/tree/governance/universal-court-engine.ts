/**
 * @file universal-court-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Universal Supreme Court & Invariant Verification.
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';

import type {
  UniversalConstitutionalInvariant,
  UniversalCourtVerdict,
  UniversalJurorVote,
} from '@/seed/types/zk-stark-constitution';

export interface UniversalDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: UniversalJurorVote[];
  supermajorityThresholdPct?: number; // default 80.0%
}

export interface UniversalCourtVerdictOutput {
  disputeCaseRef: string;
  verdict: UniversalCourtVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface UniversalInvariantCheckOutput {
  allowed: boolean;
  violationReason?: string;
  verificationHash: string;
}

/**
 * Arbitrates universal commercial disputes with 80% supermajority and 30% staking penalty.
 */
export function arbitrateUniversalDispute(input: UniversalDisputeInput): UniversalCourtVerdictOutput {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 80.0,
    slashingPenaltyPct: 30.0,
    slashingMultiplier: 0.30,
    emptyVerdict: 'DISMISSED_NO_JURISDICTION',
    emptyRulingHashFn: (_input) => createHash('sha256').update(`DISMISSED_NO_JURORS:${input.disputeCaseRef}`).digest('hex'),
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
  } as unknown as UniversalCourtVerdictOutput;
}

/**
 * Validates proposed legislative or constitutional changes against immutable universal charter.
 */
export function verifyUniversalConstitutionalInvariants(
  invariants: UniversalConstitutionalInvariant[],
  proposedTargetArticleCode: string
): UniversalInvariantCheckOutput {
  const target = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (target && target.isStrictlyImmutable) {
    const verificationHash = createHash('sha256')
      .update(`PROHIBITED_UNIVERSAL_MUTATION:${proposedTargetArticleCode}:${target.articleTitle}`)
      .digest('hex');

    return {
      allowed: false,
      violationReason: `Article ${proposedTargetArticleCode} (${target.articleTitle}) is strictly immutable under Universal Constitutional Charter`,
      verificationHash,
    };
  }

  const verificationHash = createHash('sha256')
    .update(`PERMITTED_UNIVERSAL_DIFF:${proposedTargetArticleCode}`)
    .digest('hex');

  return {
    allowed: true,
    verificationHash,
  };
}
