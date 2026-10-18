/**
 * @file sovereign-quadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quadrillion Conclave Arbitration (99.999999999% Supermajority, 99.99999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_QUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_QUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignQuadrillionConclaveVerdict,
  SovereignQuadrillionJurorVote,
  QuadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/quadrillion-holographic-stark-conclave';

export interface QuadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignQuadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.999999999%
}

export interface QuadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignQuadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface QuadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Quadrillion Conclave of Sovereign AI.
 * Requires 99.999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.99999% stake slashing.
 */
export function arbitrateSovereignQuadrillionConclaveDispute(
  input: QuadrillionDisputeInput
): QuadrillionDisputeRuling {
  return executeQuadrillionConclaveArbitration<QuadrillionDisputeRuling>(input, {
    conclavePrefix: 'QUADRILLION_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.999999999,
    slashingPenaltyPct: 99.99999000000001,
    slashingMultiplier: 0.9999999,
  });
}

/**
 * Validates invariant preservation against the Quadrillion Empire Constitutional Charter.
 */
export function verifyQuadrillionEmpireConstitutionalInvariant(
  invariant: QuadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): QuadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyQuadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: QuadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): QuadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_QUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'QUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Quadrillion',
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
