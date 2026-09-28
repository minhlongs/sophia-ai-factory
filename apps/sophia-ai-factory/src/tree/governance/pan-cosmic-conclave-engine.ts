/**
 * @file pan-cosmic-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Pan-Cosmic Constitutional Conclave Arbitration (98% Supermajority, 60% Slashing).
 */

import { createHash } from 'node:crypto';
import type {
  PanCosmicConclaveVerdict,
  PanCosmicConstitutionalInvariant,
  PanCosmicJurorVote,
} from '@/seed/types/topological-braided-conclave';

export interface PanCosmicDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: PanCosmicJurorVote[];
  supermajorityThresholdPct?: number; // Default 98.0%
}

export interface PanCosmicDisputeRuling {
  disputeCaseRef: string;
  verdict: PanCosmicConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface PanCosmicInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and state disputes via Pan-Cosmic Constitutional Conclave.
 * Requires 98.0% supermajority consensus; penalizes dissenting rogue jurors with 60% stake slashing.
 */
export function arbitratePanCosmicDispute(input: PanCosmicDisputeInput): PanCosmicDisputeRuling {
  const thresholdPct = input.supermajorityThresholdPct ?? 98.0;
  const totalJurors = input.votes.length;

  if (totalJurors === 0) {
    const emptyHash = createHash('sha256').update('NO_VOTES').digest('hex');
    return {
      disputeCaseRef: input.disputeCaseRef,
      verdict: 'PENDING_EVIDENCE',
      totalJurors: 0,
      claimantVotes: 0,
      respondentVotes: 0,
      effectiveSupermajorityPct: 0,
      jurorsSlashedCount: 0,
      totalSlashedStakeCents: 0,
      executedRemedyCents: 0,
      rulingHash: emptyHash,
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

  let verdict: PanCosmicConclaveVerdict = 'DELIBERATING';
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = Number(claimantPct.toFixed(2));
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting minority jurors (60% penalty)
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.60);
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = Number(respondentPct.toFixed(2));
    executedRemedyCents = 0;

    // Slash dissenting minority jurors (60% penalty)
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.60);
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Math.max(claimantPct, respondentPct);
  }

  const rulingHash = createHash('sha256')
    .update(
      `PAN_COSMIC_RULING:${input.disputeCaseRef}:${verdict}:${executedRemedyCents}:${totalSlashedStakeCents}`
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
 * Validates proposed changes against immutable pan-cosmic constitutional invariants.
 */
export function verifyPanCosmicConstitutionalInvariants(
  invariants: PanCosmicConstitutionalInvariant[],
  proposedTargetArticleCode: string
): PanCosmicInvariantCheckOutput {
  const match = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (!match) {
    const hash = createHash('sha256').update(`INVARIANT_NOT_FOUND:${proposedTargetArticleCode}`).digest('hex');
    return {
      allowed: true,
      articleCode: proposedTargetArticleCode,
      isStrictlyImmutable: false,
      reason: 'Article not found in constitutional invariants charter; standard modification procedure applies',
      verificationHash: hash,
    };
  }

  const hash = createHash('sha256')
    .update(`PAN_COSMIC_INVARIANT:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash}`)
    .digest('hex');

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Pan-Cosmic Constitutional Invariant ${match.articleCode} ("${match.articleTitle}"): Strictly Immutable`,
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
