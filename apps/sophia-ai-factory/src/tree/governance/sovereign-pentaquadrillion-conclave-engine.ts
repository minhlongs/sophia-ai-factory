/**
 * @file sovereign-pentaquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Penta-Quadrillion Conclave Arbitration (99.99999999999% Supermajority, 99.9999999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_PENTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_PENTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignPentaquadrillionConclaveVerdict,
  SovereignPentaquadrillionJurorVote,
  PentaquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/pentaquadrillion-braided-stark-conclave';

export interface PentaquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignPentaquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.99999999999%
}

export interface PentaquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignPentaquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface PentaquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Penta-Quadrillion Conclave of Sovereign AI.
 * Requires 99.99999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.9999999% stake slashing.
 */
export function arbitrateSovereignPentaquadrillionConclaveDispute(
  input: PentaquadrillionDisputeInput
): PentaquadrillionDisputeRuling {
  return executeQuadrillionConclaveArbitration<PentaquadrillionDisputeRuling>(input, {
    conclavePrefix: 'PENTAQUADRILLION_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.99999999999,
    slashingPenaltyPct: 99.9999999,
    slashingMultiplier: 0.999999999,
  });
}

/**
 * Validates invariant preservation against the Penta-Quadrillion Empire Constitutional Charter.
 */
export function verifyPentaquadrillionEmpireConstitutionalInvariant(
  invariant: PentaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): PentaquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Penta-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyPentaquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: PentaquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): PentaquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_PENTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'PENTAQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Penta-Quadrillion',
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
