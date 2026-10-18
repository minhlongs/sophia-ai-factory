/**
 * @file pan-dimensional-empire-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Pan-Dimensional Supreme Conclave Arbitration (99.999999% Supermajority, 99.99% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
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
  return executeQuadrillionConclaveArbitration<PanDimensionalEmpireDisputeRuling>(input, {
    conclavePrefix: 'PAN_DIMENSIONAL_EMPIRE_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.999999,
    slashingPenaltyPct: 99.99,
    slashingMultiplier: 0.9999,
  });
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
    ? (proposedTargetArticleCode ?? '')
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
