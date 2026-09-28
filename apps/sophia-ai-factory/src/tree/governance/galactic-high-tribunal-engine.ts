/**
 * @file galactic-high-tribunal-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Galactic Constitutional High Tribunal & Invariant Verification.
 */

import { createHash } from 'node:crypto';
import type {
  GalacticConstitutionalInvariant,
  GalacticJurorVote,
  GalacticTribunalVerdict,
} from '@/seed/types/holographic-stark-tribunal';

export interface GalacticDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: GalacticJurorVote[];
  supermajorityThresholdPct?: number; // default 90.0%
}

export interface GalacticTribunalVerdictOutput {
  disputeCaseRef: string;
  verdict: GalacticTribunalVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface GalacticInvariantCheckOutput {
  allowed: boolean;
  violationReason?: string;
  verificationHash: string;
}

/**
 * Arbitrates galactic commercial disputes with 90% supermajority and 40% staking penalty.
 */
export function arbitrateGalacticDispute(
  input: GalacticDisputeInput
): GalacticTribunalVerdictOutput {
  const thresholdPct = input.supermajorityThresholdPct ?? 90.0;
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

  let verdict: GalacticTribunalVerdict = 'DELIBERATING';
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = Number(claimantPct.toFixed(2));
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting minority jurors (40% penalty)
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.40);
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = Number(respondentPct.toFixed(2));
    executedRemedyCents = 0;

    // Slash dissenting minority jurors (40% penalty)
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.40);
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Math.max(claimantPct, respondentPct);
  }

  const rulingHash = createHash('sha256')
    .update(
      `GALACTIC_RULING:${input.disputeCaseRef}:${verdict}:${executedRemedyCents}:${totalSlashedStakeCents}`
    )
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
 * Validates proposed changes against immutable galactic constitutional invariants.
 */
export function verifyGalacticConstitutionalInvariants(
  invariants: GalacticConstitutionalInvariant[],
  proposedTargetArticleCode: string
): GalacticInvariantCheckOutput {
  const target = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (target && target.isStrictlyImmutable) {
    const verificationHash = createHash('sha256')
      .update(
        `PROHIBITED_GALACTIC_MUTATION:${proposedTargetArticleCode}:${target.articleTitle}`
      )
      .digest('hex');

    return {
      allowed: false,
      violationReason: `Article ${proposedTargetArticleCode} (${target.articleTitle}) is strictly immutable under Galactic Constitutional Charter`,
      verificationHash,
    };
  }

  const verificationHash = createHash('sha256')
    .update(`PERMITTED_GALACTIC_DIFF:${proposedTargetArticleCode}`)
    .digest('hex');

  return {
    allowed: true,
    verificationHash,
  };
}
