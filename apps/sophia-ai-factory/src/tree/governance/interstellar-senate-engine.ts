/**
 * @file interstellar-senate-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Interstellar Supreme Senate & Invariant Verification.
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';

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
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 85.0,
    slashingPenaltyPct: 35.0,
    slashingMultiplier: 0.35,
    emptyVerdict: 'DISMISSED_NO_JURISDICTION',
    emptyRulingHashFn: (_input) => createHash('sha256').update(`DISMISSED_NO_SENATORS:${input.disputeCaseRef}`).digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`DISMISSED_NO_SENATORS:${ctx.disputeCaseRef}`)
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
  } as unknown as InterstellarSenateVerdictOutput;
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
