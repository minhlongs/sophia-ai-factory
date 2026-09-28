/**
 * @file multiverse-directorate-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Multiverse Constitutional Supreme Directorate & Invariant Verification.
 */

import { createHash } from 'node:crypto';
import type {
  MultiverseConstitutionalInvariant,
  MultiverseDirectorateVerdict,
  MultiverseJurorVote,
} from '@/seed/types/anyonic-stark-directorate';

export interface MultiverseDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: MultiverseJurorVote[];
  supermajorityThresholdPct?: number; // default 95.0%
}

export interface MultiverseDirectorateVerdictOutput {
  disputeCaseRef: string;
  verdict: MultiverseDirectorateVerdict;
  totalDirectors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  directorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface MultiverseInvariantCheckOutput {
  allowed: boolean;
  violationReason?: string;
  verificationHash: string;
}

/**
 * Arbitrates multiverse commercial disputes with 95% supermajority and 50% staking penalty.
 */
export function arbitrateMultiverseDispute(
  input: MultiverseDisputeInput
): MultiverseDirectorateVerdictOutput {
  const thresholdPct = input.supermajorityThresholdPct ?? 95.0;
  const totalDirectors = input.votes.length;

  if (totalDirectors === 0) {
    const rulingHash = createHash('sha256')
      .update(`DISMISSED_NO_DIRECTORS:${input.disputeCaseRef}`)
      .digest('hex');
    return {
      disputeCaseRef: input.disputeCaseRef,
      verdict: 'DISMISSED_NO_JURISDICTION',
      totalDirectors: 0,
      claimantVotes: 0,
      respondentVotes: 0,
      effectiveSupermajorityPct: 0,
      directorsSlashedCount: 0,
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

  const claimantPct = (claimantVotes / totalDirectors) * 100;
  const respondentPct = (respondentVotes / totalDirectors) * 100;

  let verdict: MultiverseDirectorateVerdict = 'DELIBERATING';
  let directorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = Number(claimantPct.toFixed(2));
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting minority jurors (50% penalty)
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        directorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.50);
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = Number(respondentPct.toFixed(2));
    executedRemedyCents = 0;

    // Slash dissenting minority jurors (50% penalty)
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        directorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.50);
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Math.max(claimantPct, respondentPct);
  }

  const rulingHash = createHash('sha256')
    .update(
      `MULTIVERSE_RULING:${input.disputeCaseRef}:${verdict}:${executedRemedyCents}:${totalSlashedStakeCents}`
    )
    .digest('hex');

  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict,
    totalDirectors,
    claimantVotes,
    respondentVotes,
    effectiveSupermajorityPct,
    directorsSlashedCount,
    totalSlashedStakeCents,
    executedRemedyCents,
    rulingHash,
  };
}

/**
 * Validates proposed changes against immutable multiverse constitutional invariants.
 */
export function verifyMultiverseConstitutionalInvariants(
  invariants: MultiverseConstitutionalInvariant[],
  proposedTargetArticleCode: string
): MultiverseInvariantCheckOutput {
  const target = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (target && target.isStrictlyImmutable) {
    const verificationHash = createHash('sha256')
      .update(
        `PROHIBITED_MULTIVERSE_MUTATION:${proposedTargetArticleCode}:${target.articleTitle}`
      )
      .digest('hex');

    return {
      allowed: false,
      violationReason: `Article ${proposedTargetArticleCode} (${target.articleTitle}) is strictly immutable under Multiverse Constitutional Charter`,
      verificationHash,
    };
  }

  const verificationHash = createHash('sha256')
    .update(`PERMITTED_MULTIVERSE_DIFF:${proposedTargetArticleCode}`)
    .digest('hex');

  return {
    allowed: true,
    verificationHash,
  };
}
