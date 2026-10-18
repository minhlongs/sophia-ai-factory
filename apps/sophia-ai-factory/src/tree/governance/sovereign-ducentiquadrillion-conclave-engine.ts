/**
 * @file sovereign-ducentiquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Ducenti-Quadrillion Conclave Arbitration (99.9999999999999999% Supermajority, 99.999999999% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_DUCENTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_DUCENTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignDucentiquadrillionConclaveVerdict,
  SovereignDucentiquadrillionJurorVote,
  DucentiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/ducentiquadrillion-braided-stark-conclave';

export interface DucentiquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignDucentiquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9999999999999999%
}

export interface DucentiquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignDucentiquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface DucentiquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Ducenti-Quadrillion Conclave of Sovereign AI.
 * Requires 99.9999999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999999% stake slashing.
 */
export function arbitrateSovereignDucentiquadrillionConclaveDispute(
  input: DucentiquadrillionDisputeInput
): DucentiquadrillionDisputeRuling {
  return executeQuadrillionConclaveArbitration<DucentiquadrillionDisputeRuling>(input, {
    conclavePrefix: 'DUCENTIQUADRILLION_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.9999999999999999,
    slashingPenaltyPct: 99.9999999,
    slashingMultiplier: 0.999999999,
  });
}

/**
 * Validates invariant preservation against the Ducenti-Quadrillion Empire Constitutional Charter.
 */
export function verifyDucentiquadrillionEmpireConstitutionalInvariant(
  invariant: DucentiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): DucentiquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Ducenti-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyDucentiquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: DucentiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): DucentiquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_DUCENTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'DUCENTIQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Ducenti-Quadrillion',
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
