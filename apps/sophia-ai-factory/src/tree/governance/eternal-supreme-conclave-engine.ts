/**
 * @file eternal-supreme-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Eternal Supreme Conclave Arbitration (99.99999999% Supermajority, 99.9999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_ETERNAL_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-supreme-invariants';

export {
  CANONICAL_ETERNAL_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-supreme-invariants';

import type {
  EternalEmpireConstitutionalInvariant,
  EternalEmpireJurorVote,
  EternalSupremeConclaveVerdict,
} from '@/seed/types/infinite-holographic-stark-conclave';

export interface EternalEmpireDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: EternalEmpireJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.99999999%
}

export interface EternalEmpireDisputeRuling {
  disputeCaseRef: string;
  verdict: EternalSupremeConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface EternalEmpireInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Eternal Supreme Conclave of Sovereign AI.
 * Requires 99.99999999% supermajority consensus; penalizes dissenting rogue jurors with 99.9999% stake slashing.
 */
export function arbitrateEternalSupremeConclaveDispute(
  input: EternalEmpireDisputeInput
): EternalEmpireDisputeRuling {
  return executeQuadrillionConclaveArbitration<EternalEmpireDisputeRuling>(input, {
    conclavePrefix: 'ETERNAL_SUPREME_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.99999999,
    slashingPenaltyPct: 99.9999,
    slashingMultiplier: 0.999999,
  });
}

/**
 * Validates invariant preservation against the Eternal Empire Constitutional Charter.
 */
export function verifyEternalEmpireConstitutionalInvariant(
  invariant: EternalEmpireConstitutionalInvariant,
  proposedAction: string
): EternalEmpireInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Eternal',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyEternalEmpireConstitutionalInvariants(
  invariantsOrCode: EternalEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): EternalEmpireInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_ETERNAL_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'ETERNAL_EMPIRE_INVARIANT',
      reasonPrefix: 'Eternal',
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
