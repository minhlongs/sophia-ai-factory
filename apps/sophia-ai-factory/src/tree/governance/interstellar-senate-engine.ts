/**
 * @file interstellar-senate-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Interstellar Supreme Senate & Invariant Verification.
 */

import { createHash } from 'node:crypto';
import type {
  InterstellarConstitutionalInvariant,
  InterstellarJurorVote,
  InterstellarSenateVerdict,
} from '@/seed/types/hyper-stark-senate';

export interface InterstellarDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: InterstellarJurorVote[];
  supermajorityThresholdPct?: number; // default 85.0%
}

export interface InterstellarSenateVerdictOutput {
  disputeCaseRef: string;
  verdict: InterstellarSenateVerdict;
  totalSenators: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  senatorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface InterstellarInvariantCheckOutput {
  allowed: boolean;
  violationReason?: string;
  verificationHash: string;
}

/**
 * Arbitrates interstellar commercial disputes with 85% supermajority and 35% staking penalty.
 */
export function arbitrateInterstellarDispute(
  input: InterstellarDisputeInput
): InterstellarSenateVerdictOutput {
  const thresholdPct = input.supermajorityThresholdPct ?? 85.0;
  const totalSenators = input.votes.length;

  if (totalSenators === 0) {
    const rulingHash = createHash('sha256')
      .update(`DISMISSED_NO_SENATORS:${input.disputeCaseRef}`)
      .digest('hex');
    return {
      disputeCaseRef: input.disputeCaseRef,
      verdict: 'DISMISSED_NO_JURISDICTION',
      totalSenators: 0,
      claimantVotes: 0,
      respondentVotes: 0,
      effectiveSupermajorityPct: 0,
      senatorsSlashedCount: 0,
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

  const claimantPct = (claimantVotes / totalSenators) * 100;
  const respondentPct = (respondentVotes / totalSenators) * 100;

  let verdict: InterstellarSenateVerdict = 'DELIBERATING';
  let senatorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = Number(claimantPct.toFixed(2));
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting minority jurors (35% penalty)
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        senatorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.35);
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = Number(respondentPct.toFixed(2));
    executedRemedyCents = 0;

    // Slash dissenting minority jurors (35% penalty)
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        senatorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.35);
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Math.max(claimantPct, respondentPct);
  }

  const rulingHash = createHash('sha256')
    .update(
      `INTERSTELLAR_RULING:${input.disputeCaseRef}:${verdict}:${executedRemedyCents}:${totalSlashedStakeCents}`
    )
    .digest('hex');

  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict,
    totalSenators,
    claimantVotes,
    respondentVotes,
    effectiveSupermajorityPct,
    senatorsSlashedCount,
    totalSlashedStakeCents,
    executedRemedyCents,
    rulingHash,
  };
}

/**
 * Validates proposed changes against immutable interstellar constitutional invariants.
 */
export function verifyInterstellarConstitutionalInvariants(
  invariants: InterstellarConstitutionalInvariant[],
  proposedTargetArticleCode: string
): InterstellarInvariantCheckOutput {
  const target = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (target && target.isStrictlyImmutable) {
    const verificationHash = createHash('sha256')
      .update(
        `PROHIBITED_INTERSTELLAR_MUTATION:${proposedTargetArticleCode}:${target.articleTitle}`
      )
      .digest('hex');

    return {
      allowed: false,
      violationReason: `Article ${proposedTargetArticleCode} (${target.articleTitle}) is strictly immutable under Interstellar Constitutional Charter`,
      verificationHash,
    };
  }

  const verificationHash = createHash('sha256')
    .update(`PERMITTED_INTERSTELLAR_DIFF:${proposedTargetArticleCode}`)
    .digest('hex');

  return {
    allowed: true,
    verificationHash,
  };
}
