/**
 * @file omni-dimensional-supreme-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Omni-Dimensional Supreme Conclave Arbitration (99.9999% Supermajority, 99.9% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';

import type {
  OmniDimensionalConclaveVerdict,
  OmniDimensionalConstitutionalInvariant,
  OmniDimensionalJurorVote,
} from '@/seed/types/omni-dimensional-stark-conclave';

export interface OmniDimensionalDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: OmniDimensionalJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9999%
}

export interface OmniDimensionalDisputeRuling {
  disputeCaseRef: string;
  verdict: OmniDimensionalConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface OmniDimensionalInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Omni-Dimensional Supreme Conclave of Sovereign AI.
 * Requires 99.9999% supermajority consensus; penalizes dissenting rogue jurors with 99.9% stake slashing.
 */
export function arbitrateOmniDimensionalConclaveDispute(
  input: OmniDimensionalDisputeInput
): OmniDimensionalDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.9999,
    slashingPenaltyPct: 99.9,
    slashingMultiplier: 0.999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`OMNI_DIMENSIONAL_CONCLAVE_RULING:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.executedRemedyCents}:${ctx.totalSlashedStakeCents}`)
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
  } as unknown as OmniDimensionalDisputeRuling;
}

/**
 * Validates invariant preservation against the Omni-Dimensional Constitutional Charter.
 */
export function verifyOmniDimensionalConstitutionalInvariant(
  invariant: OmniDimensionalConstitutionalInvariant,
  proposedAction: string
): OmniDimensionalInvariantCheckOutput {
  const isStrictlyImmutable = invariant.isStrictlyImmutable;

  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    const rejectHash = createHash('sha256')
      .update(`CONSTITUTIONAL_BREACH_REJECTED:${invariant.articleCode}`)
      .digest('hex');

    return {
      allowed: false,
      articleCode: invariant.articleCode,
      isStrictlyImmutable,
      reason: `Action violates strictly immutable Omni-Dimensional constitutional article ${invariant.articleCode}: ${invariant.articleTitle}`,
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
 * Validates proposed changes against immutable omni-dimensional constitutional invariants.
 */
export function verifyOmniDimensionalConstitutionalInvariants(
  invariants: OmniDimensionalConstitutionalInvariant[],
  proposedTargetArticleCode: string
): OmniDimensionalInvariantCheckOutput {
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
    .update(`OMNI_DIMENSIONAL_INVARIANT:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash}`)
    .digest('hex');

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Omni-Dimensional Constitutional Invariant ${match.articleCode} ("${match.articleTitle}"): Strictly Immutable`,
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
