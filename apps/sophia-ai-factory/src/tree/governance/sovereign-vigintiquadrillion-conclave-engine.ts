/**
 * @file sovereign-vigintiquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Viginti-Quadrillion Conclave Arbitration (99.9999999999999% Supermajority, 99.999999999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_VIGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_VIGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignVigintiquadrillionConclaveVerdict,
  SovereignVigintiquadrillionJurorVote,
  VigintiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/vigintiquadrillion-braided-stark-conclave';

export interface VigintiquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignVigintiquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9999999999999%
}

export interface VigintiquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignVigintiquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface VigintiquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Viginti-Quadrillion Conclave of Sovereign AI.
 * Requires 99.9999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999999% stake slashing.
 */
export function arbitrateSovereignVigintiquadrillionConclaveDispute(
  input: VigintiquadrillionDisputeInput
): VigintiquadrillionDisputeRuling {
  return executeQuadrillionConclaveArbitration<VigintiquadrillionDisputeRuling>(input, {
    conclavePrefix: 'VIGINTIQUADRILLION_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.9999999999999,
    slashingPenaltyPct: 99.9999999,
    slashingMultiplier: 0.999999999,
  });
}

/**
 * Validates invariant preservation against the Viginti-Quadrillion Empire Constitutional Charter.
 */
export function verifyVigintiquadrillionEmpireConstitutionalInvariant(
  invariant: VigintiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): VigintiquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Viginti-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyVigintiquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: VigintiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): VigintiquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_VIGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'VIGINTIQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Viginti-Quadrillion',
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
