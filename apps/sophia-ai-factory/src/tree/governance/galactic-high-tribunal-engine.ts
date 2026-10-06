/**
 * @file galactic-high-tribunal-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Galactic Constitutional High Tribunal & Invariant Verification.
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';

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
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 90.0,
    slashingPenaltyPct: 40.0,
    slashingMultiplier: 0.40,
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
  } as unknown as GalacticTribunalVerdictOutput;
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
