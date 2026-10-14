/**
 * @file pan-dimensional-empire-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Pan-Dimensional Supreme Conclave Arbitration (99.999999% Supermajority, 99.99% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_PAN_DIMENSIONAL_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-supreme-invariants';

export {
  CANONICAL_PAN_DIMENSIONAL_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-supreme-invariants';

import type {
  PanDimensionalEmpireConstitutionalInvariant,
  PanDimensionalEmpireJurorVote,
  PanDimensionalSupremeConclaveVerdict,
} from '@/seed/types/pan-dimensional-holographic-stark-conclave';

export interface PanDimensionalEmpireDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: PanDimensionalEmpireJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.999999%
}

export interface PanDimensionalEmpireDisputeRuling {
  disputeCaseRef: string;
  verdict: PanDimensionalSupremeConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface PanDimensionalEmpireInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Pan-Dimensional Supreme Conclave of Sovereign AI.
 * Requires 99.999999% supermajority consensus; penalizes dissenting rogue jurors with 99.99% stake slashing.
 */
export function arbitratePanDimensionalEmpireConclaveDispute(
  input: PanDimensionalEmpireDisputeInput
): PanDimensionalEmpireDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.999999,
    slashingPenaltyPct: 99.99,
    slashingMultiplier: 0.9999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`PAN_DIMENSIONAL_EMPIRE_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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
  } as unknown as PanDimensionalEmpireDisputeRuling;
}

/**
 * Validates invariant preservation against the Pan-Dimensional Empire Constitutional Charter.
 */
export function verifyPanDimensionalEmpireConstitutionalInvariant(
  invariant: PanDimensionalEmpireConstitutionalInvariant,
  proposedAction: string
): PanDimensionalEmpireInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Pan-Dimensional',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyPanDimensionalEmpireConstitutionalInvariants(
  invariantsOrCode: PanDimensionalEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): PanDimensionalEmpireInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_PAN_DIMENSIONAL_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? "")
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'PAN_DIMENSIONAL_EMPIRE_INVARIANT',
      reasonPrefix: 'Pan-Dimensional',
    }
  );

  return {
    allowed: result.allowed,
    articleCode: result.articleCode,
    isStrictlyImmutable: result.isStrictlyImmutable,
    reason: result.reason,
    verificationHash: result.verificationHash ?? '',
  };
}
