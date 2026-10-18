/**
 * @file sovereign-quinquagintiquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quinquaginti-Quadrillion Conclave Arbitration (99.99999999999999% Supermajority, 99.999999999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignQuinquagintiquadrillionConclaveVerdict,
  SovereignQuinquagintiquadrillionJurorVote,
  QuinquagintiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/quinquagintiquadrillion-braided-stark-conclave';

export interface QuinquagintiquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignQuinquagintiquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.99999999999999%
}

export interface QuinquagintiquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignQuinquagintiquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface QuinquagintiquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Quinquaginti-Quadrillion Conclave of Sovereign AI.
 * Requires 99.99999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999999% stake slashing.
 */
export function arbitrateSovereignQuinquagintiquadrillionConclaveDispute(
  input: QuinquagintiquadrillionDisputeInput
): QuinquagintiquadrillionDisputeRuling {
  return executeQuadrillionConclaveArbitration<QuinquagintiquadrillionDisputeRuling>(input, {
    conclavePrefix: 'QUINQUAGINTIQUADRILLION_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.99999999999999,
    slashingPenaltyPct: 99.9999999,
    slashingMultiplier: 0.999999999,
  });
}

/**
 * Validates invariant preservation against the Quinquaginti-Quadrillion Empire Constitutional Charter.
 */
export function verifyQuinquagintiquadrillionEmpireConstitutionalInvariant(
  invariant: QuinquagintiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): QuinquagintiquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Quinquaginti-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyQuinquagintiquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: QuinquagintiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): QuinquagintiquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'QUINQUAGINTIQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Quinquaginti-Quadrillion',
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
