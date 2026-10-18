/**
 * @file sovereign-quinquagintaquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quinquaginta-Quadrillion Conclave Arbitration (99.99999999999999999% Supermajority, 99.9999999999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_QUINQUAGINTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_QUINQUAGINTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignQuinquagintaquadrillionConclaveVerdict,
  SovereignQuinquagintaquadrillionJurorVote,
  QuinquagintaquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/quinquagintaquadrillion-braided-stark-conclave';

export interface QuinquagintaquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignQuinquagintaquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.99999999999999999%
}

export interface QuinquagintaquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignQuinquagintaquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface QuinquagintaquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Quinquaginta-Quadrillion Conclave of Sovereign AI.
 * Requires 99.99999999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.9999999999% stake slashing.
 */
export function arbitrateSovereignQuinquagintaquadrillionConclaveDispute(
  input: QuinquagintaquadrillionDisputeInput
): QuinquagintaquadrillionDisputeRuling {
  return executeQuadrillionConclaveArbitration<QuinquagintaquadrillionDisputeRuling>(input, {
    conclavePrefix: 'QUINQUAGINTAQUADRILLION_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.99999999999999999,
    slashingPenaltyPct: 99.99999998999999,
    slashingMultiplier: 0.9999999999,
  });
}

/**
 * Validates invariant preservation against the Quinquaginta-Quadrillion Empire Constitutional Charter.
 */
export function verifyQuinquagintaquadrillionEmpireConstitutionalInvariant(
  invariant: QuinquagintaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): QuinquagintaquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Quinquaginta-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyQuinquagintaquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: QuinquagintaquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): QuinquagintaquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_QUINQUAGINTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'QUINQUAGINTAQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Quinquaginta-Quadrillion',
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
