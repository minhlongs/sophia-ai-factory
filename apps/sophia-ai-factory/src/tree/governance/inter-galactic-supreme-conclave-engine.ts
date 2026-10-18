/**
 * @file inter-galactic-supreme-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Omni-Cosmic Supreme Conclave Arbitration (99.99999% Supermajority, 99.95% Slashing).
 */

import {
  executeQuadrillionConclaveArbitration,
  verifyQuadrillionConstitutionalInvariant,
} from './sovereign-conclave-shared-math';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import { CANONICAL_INTER_GALACTIC_CONSTITUTIONAL_INVARIANTS } from './inter-galactic-conclave-invariants';

export { CANONICAL_INTER_GALACTIC_CONSTITUTIONAL_INVARIANTS } from './inter-galactic-conclave-invariants';

import type {
  InterGalacticConclaveVerdict,
  InterGalacticConstitutionalInvariant,
  InterGalacticJurorVote,
} from '@/seed/types/inter-galactic-stark-conclave';

export interface InterGalacticDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: InterGalacticJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.99999%
}

export interface InterGalacticDisputeRuling {
  disputeCaseRef: string;
  verdict: InterGalacticConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface InterGalacticInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Omni-Cosmic Supreme Conclave of Sovereign AI.
 * Requires 99.99999% supermajority consensus; penalizes dissenting rogue jurors with 99.95% stake slashing.
 */
export function arbitrateInterGalacticConclaveDispute(
  input: InterGalacticDisputeInput
): InterGalacticDisputeRuling {
  return executeQuadrillionConclaveArbitration<InterGalacticDisputeRuling>(input, {
    conclavePrefix: 'INTER_GALACTIC_CONCLAVE',
    defaultSupermajorityThresholdPct: 99.99999,
    slashingPenaltyPct: 99.95,
    slashingMultiplier: 0.9995,
  });
}

/**
 * Validates invariant preservation against the Inter-Galactic Constitutional Charter.
 */
export function verifyInterGalacticConstitutionalInvariant(
  invariant: InterGalacticConstitutionalInvariant,
  proposedAction: string
): InterGalacticInvariantCheckOutput {
  return verifyQuadrillionConstitutionalInvariant(invariant, proposedAction, 'Omni-Cosmic');
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyInterGalacticConstitutionalInvariants(
  invariantsOrCode: InterGalacticConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): InterGalacticInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_INTER_GALACTIC_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? '')
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'INTER_GALACTIC_INVARIANT',
      reasonPrefix: 'Omni-Cosmic',
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
