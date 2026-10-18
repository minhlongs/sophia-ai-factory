/**
 * @file sovereign-decaquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Deca-Quadrillion Conclave Arbitration (99.999999999999% Supermajority, 99.99999999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_DECAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-supreme-invariants';

export {
  CANONICAL_DECAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-supreme-invariants';

import type {
  SovereignDecaquadrillionConclaveVerdict,
  SovereignDecaquadrillionJurorVote,
  DecaquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/decaquadrillion-braided-stark-conclave';

export interface DecaquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignDecaquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.999999999999%
}

export interface DecaquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignDecaquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface DecaquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Deca-Quadrillion Conclave of Sovereign AI.
 * Requires 99.999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.99999999% stake slashing.
 */
export function arbitrateSovereignDecaquadrillionConclaveDispute(
  input: DecaquadrillionDisputeInput
): DecaquadrillionDisputeRuling {
  return executeQuadrillionConclaveArbitration<DecaquadrillionDisputeRuling>(input, {
    conclavePrefix: 'DECAQUADRILLION_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.999999999999,
    slashingPenaltyPct: 99.99999899999999,
    slashingMultiplier: 0.99999999,
  });
}

/**
 * Validates invariant preservation against the Deca-Quadrillion Empire Constitutional Charter.
 */
export function verifyDecaquadrillionEmpireConstitutionalInvariant(
  invariant: DecaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): DecaquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Deca-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyDecaquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: DecaquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): DecaquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_DECAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'DECAQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Deca-Quadrillion',
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
