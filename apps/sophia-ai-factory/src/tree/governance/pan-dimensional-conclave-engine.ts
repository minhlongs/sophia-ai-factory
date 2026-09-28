/**
 * @file pan-dimensional-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Pan-Dimensional Supreme Conclave Arbitration (99.9% Supermajority, 90% Slashing).
 */

import { createHash } from 'node:crypto';
import type {
  PanDimensionalConclaveVerdict,
  PanDimensionalConstitutionalInvariant,
  PanDimensionalJurorVote,
} from '@/seed/types/topological-stark-conclave';

export interface PanDimensionalDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: PanDimensionalJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9%
}

export interface PanDimensionalDisputeRuling {
  disputeCaseRef: string;
  verdict: PanDimensionalConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface PanDimensionalInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Pan-Dimensional Supreme Conclave of Sovereign AI.
 * Requires 99.9% supermajority consensus; penalizes dissenting rogue jurors with 90% stake slashing.
 */
export function arbitratePanDimensionalConclaveDispute(
  input: PanDimensionalDisputeInput
): PanDimensionalDisputeRuling {
  const thresholdPct = input.supermajorityThresholdPct ?? 99.9;
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

  let verdict: PanDimensionalConclaveVerdict = 'DELIBERATING';
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = Number(claimantPct.toFixed(2));
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting minority jurors (90% penalty)
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.90);
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = Number(respondentPct.toFixed(2));
    executedRemedyCents = 0;

    // Slash dissenting minority jurors (90% penalty)
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.90);
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Math.max(claimantPct, respondentPct);
  }

  const rulingHash = createHash('sha256')
    .update(
      `PAN_DIMENSIONAL_CONCLAVE_RULING:${input.disputeCaseRef}:${verdict}:${executedRemedyCents}:${totalSlashedStakeCents}`
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
 * Validates invariant preservation against the Pan-Dimensional Constitutional Charter.
 */
export function verifyPanDimensionalConstitutionalInvariant(
  invariant: PanDimensionalConstitutionalInvariant,
  proposedAction: string
): PanDimensionalInvariantCheckOutput {
  const isStrictlyImmutable = invariant.isStrictlyImmutable;

  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    const rejectHash = createHash('sha256')
      .update(`CONSTITUTIONAL_BREACH_REJECTED:${invariant.articleCode}`)
      .digest('hex');

    return {
      allowed: false,
      articleCode: invariant.articleCode,
      isStrictlyImmutable,
      reason: `Action violates strictly immutable Pan-Dimensional constitutional article ${invariant.articleCode}: ${invariant.articleTitle}`,
      verificationHash: rejectHash,
    };
  }

  const allowHash = createHash('sha256')
    .update(`CONSTITUTIONAL_ACTION_PERMITTED:${invariant.articleCode}:${proposedAction}`)
    .digest('hex');

  return {
    allowed: true,
    articleCode: invariant.articleCode,
    isStrictlyImmutable,
    verificationHash: allowHash,
  };
}

/**
 * Validates proposed changes against immutable pan-dimensional constitutional invariants.
 */
export function verifyPanDimensionalConstitutionalInvariants(
  invariants: PanDimensionalConstitutionalInvariant[],
  proposedTargetArticleCode: string
): PanDimensionalInvariantCheckOutput {
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
    .update(`PAN_DIMENSIONAL_INVARIANT:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash}`)
    .digest('hex');

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Pan-Dimensional Constitutional Invariant ${match.articleCode} ("${match.articleTitle}"): Strictly Immutable`,
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

