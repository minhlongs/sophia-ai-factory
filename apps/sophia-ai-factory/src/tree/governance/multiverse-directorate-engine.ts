/**
 * @file multiverse-directorate-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Multiverse Constitutional Supreme Directorate & Invariant Verification.
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';

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
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 95.0,
    slashingPenaltyPct: 50.0,
    slashingMultiplier: 0.50,
    emptyVerdict: 'DISMISSED_NO_JURISDICTION',
    emptyRulingHashFn: (_input) => createHash('sha256').update(`DISMISSED_NO_DIRECTORS:${input.disputeCaseRef}`).digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`DISMISSED_NO_DIRECTORS:${ctx.disputeCaseRef}`)
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
  } as unknown as MultiverseDirectorateVerdictOutput;
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
