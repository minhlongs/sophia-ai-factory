/**
 * @file universal-court-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Universal Supreme Court & Invariant Verification.
 */

import { createHash } from 'node:crypto';
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
  const thresholdPct = input.supermajorityThresholdPct ?? 80.0;
  const totalJurors = input.votes.length;

  if (totalJurors === 0) {
    const rulingHash = createHash('sha256')
      .update(`DISMISSED_NO_JURORS:${input.disputeCaseRef}`)
      .digest('hex');
    return {
      disputeCaseRef: input.disputeCaseRef,
      verdict: 'DISMISSED_NO_JURISDICTION',
      totalJurors: 0,
      claimantVotes: 0,
      respondentVotes: 0,
      effectiveSupermajorityPct: 0,
      jurorsSlashedCount: 0,
      totalSlashedStakeCents: 0,
      executedRemedyCents: 0,
      rulingHash,
    };
  }

  let claimantVotes = 0;
  let respondentVotes = 0;

  for (const v of input.votes) {
    if (v.voteForClaimant) {
      claimantVotes++;
    } else {
      respondentVotes++;
    }
  }

  const claimantPct = (claimantVotes / totalJurors) * 100;
  const respondentPct = (respondentVotes / totalJurors) * 100;

  let verdict: UniversalCourtVerdict = 'DELIBERATING';
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = Number(claimantPct.toFixed(2));
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting minority jurors (30% penalty)
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.30);
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = Number(respondentPct.toFixed(2));
    executedRemedyCents = 0;

    // Slash dissenting minority jurors (30% penalty)
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.30);
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Math.max(claimantPct, respondentPct);
  }

  const rulingHash = createHash('sha256')
    .update(`UNIVERSAL_RULING:${input.disputeCaseRef}:${verdict}:${executedRemedyCents}:${totalSlashedStakeCents}`)
    .digest('hex');

  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict,
    totalJurors,
    claimantVotes,
    respondentVotes,
    effectiveSupermajorityPct,
    jurorsSlashedCount,
    totalSlashedStakeCents,
    executedRemedyCents,
    rulingHash,
  };
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
