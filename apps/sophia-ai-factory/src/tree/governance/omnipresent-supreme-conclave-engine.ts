/**
 * @file omnipresent-supreme-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Omnipresent Supreme Conclave Arbitration (99.9999999% Supermajority, 99.999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_OMNIPRESENT_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-supreme-invariants';

export {
  CANONICAL_OMNIPRESENT_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-supreme-invariants';

import type {
  OmnipresentEmpireConstitutionalInvariant,
  OmnipresentEmpireJurorVote,
  OmnipresentSupremeConclaveVerdict,
} from '@/seed/types/omniversal-holographic-stark-conclave';

export interface OmnipresentEmpireDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: OmnipresentEmpireJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9999999%
}

export interface OmnipresentEmpireDisputeRuling {
  disputeCaseRef: string;
  verdict: OmnipresentSupremeConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface OmnipresentEmpireInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Omnipresent Supreme Conclave of Sovereign AI.
 * Requires 99.9999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999% stake slashing.
 */
export function arbitrateOmnipresentSupremeConclaveDispute(
  input: OmnipresentEmpireDisputeInput
): OmnipresentEmpireDisputeRuling {
  return executeQuadrillionConclaveArbitration<OmnipresentEmpireDisputeRuling>(input, {
    conclavePrefix: 'OMNIPRESENT_SUPREME_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.9999999,
    slashingPenaltyPct: 99.99900000000001,
    slashingMultiplier: 0.99999,
  });
}

/**
 * Validates invariant preservation against the Omnipresent Empire Constitutional Charter.
 */
export function verifyOmnipresentEmpireConstitutionalInvariant(
  invariant: OmnipresentEmpireConstitutionalInvariant,
  proposedAction: string
): OmnipresentEmpireInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Omnipresent',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyOmnipresentEmpireConstitutionalInvariants(
  invariantsOrCode: OmnipresentEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): OmnipresentEmpireInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_OMNIPRESENT_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'OMNIPRESENT_EMPIRE_INVARIANT',
      reasonPrefix: 'Omnipresent',
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
