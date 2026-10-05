/**
 * @file trans-dimensional-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Trans-Dimensional Supreme Conclave Arbitration (99% Supermajority, 70% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
  verifyParameterizedConstitutionalInvariants,
} from './sovereign-conclave-domain-engine';

import type {
  TransDimensionalConclaveVerdict,
  TransDimensionalConstitutionalInvariant,
  TransDimensionalJurorVote,
} from '@/seed/types/non-euclidean-stark-conclave';

export interface TransDimensionalDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: TransDimensionalJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.0%
}

export interface TransDimensionalDisputeRuling {
  disputeCaseRef: string;
  verdict: TransDimensionalConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface TransDimensionalInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and state disputes via Trans-Dimensional Supreme Conclave Directorate.
 * Requires 99.0% supermajority consensus; penalizes dissenting rogue jurors with 70% stake slashing.
 */
export function arbitrateTransDimensionalDispute(
  input: TransDimensionalDisputeInput
): TransDimensionalDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.0,
    slashingPenaltyPct: 70.0,
    slashingMultiplier: 0.70,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`TRANS_DIMENSIONAL_RULING:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.executedRemedyCents}:${ctx.totalSlashedStakeCents}`)
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
  } as unknown as TransDimensionalDisputeRuling;
}

/**
 * Validates proposed changes against immutable trans-dimensional constitutional invariants.
 */
export function verifyTransDimensionalConstitutionalInvariants(
  invariants: TransDimensionalConstitutionalInvariant[],
  proposedTargetArticleCode: string
): TransDimensionalInvariantCheckOutput {
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
    .update(`TRANS_DIMENSIONAL_INVARIANT:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash}`)
    .digest('hex');

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Trans-Dimensional Constitutional Invariant ${match.articleCode} ("${match.articleTitle}"): Strictly Immutable`,
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
