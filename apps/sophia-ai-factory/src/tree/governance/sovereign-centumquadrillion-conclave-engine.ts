/**
 * @file sovereign-centumquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Centum-Quadrillion Conclave Arbitration (99.999999999999999% Supermajority, 99.999999999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_CENTUMQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-supreme-invariants';

export {
  CANONICAL_CENTUMQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-supreme-invariants';

import type {
  SovereignCentumquadrillionConclaveVerdict,
  SovereignCentumquadrillionJurorVote,
  CentumquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/centumquadrillion-braided-stark-conclave';

export interface CentumquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignCentumquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.999999999999999%
}

export interface CentumquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignCentumquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface CentumquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Centum-Quadrillion Conclave of Sovereign AI.
 * Requires 99.999999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999999% stake slashing.
 */
export function arbitrateSovereignCentumquadrillionConclaveDispute(
  input: CentumquadrillionDisputeInput
): CentumquadrillionDisputeRuling {
  return executeQuadrillionConclaveArbitration<CentumquadrillionDisputeRuling>(input, {
    conclavePrefix: 'CENTUMQUADRILLION_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.999999999999999,
    slashingPenaltyPct: 99.9999999,
    slashingMultiplier: 0.999999999,
  });
}

/**
 * Validates invariant preservation against the Centum-Quadrillion Empire Constitutional Charter.
 */
export function verifyCentumquadrillionEmpireConstitutionalInvariant(
  invariant: CentumquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): CentumquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Centum-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyCentumquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: CentumquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): CentumquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_CENTUMQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'CENTUMQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Centum-Quadrillion',
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
