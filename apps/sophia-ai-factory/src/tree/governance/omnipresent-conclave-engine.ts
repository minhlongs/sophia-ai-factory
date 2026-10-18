/**
 * @file omnipresent-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Omnipresent Supreme Conclave Arbitration (99.95% Supermajority, 95% Slashing).
 */

import {
  executeParameterizedConclaveRuling,
  verifyConstitutionalInvariantsList,
  verifySingleConstitutionalInvariant,
} from './conclave-engine-shared-helpers';

import type {
  OmnipresentConclaveVerdict,
  OmnipresentConstitutionalInvariant,
  OmnipresentJurorVote,
} from '@/seed/types/braided-stark-conclave';

export interface OmnipresentDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: OmnipresentJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.95%
}

export interface OmnipresentDisputeRuling {
  disputeCaseRef: string;
  verdict: OmnipresentConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface OmnipresentInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Omnipresent Supreme Conclave of Sovereign AI.
 * Requires 99.95% supermajority consensus; penalizes dissenting rogue jurors with 95% stake slashing.
 */
export function arbitrateOmnipresentConclaveDispute(
  input: OmnipresentDisputeInput
): OmnipresentDisputeRuling {
  return executeParameterizedConclaveRuling<OmnipresentDisputeRuling>(
    input,
    {
      defaultSupermajorityThresholdPct: 99.95,
      slashingPenaltyPct: 95.0,
      slashingMultiplier: 0.95,
      rulingPrefix: 'OMNIPRESENT_CONCLAVE_RULING',
    }
  );
}

/**
 * Validates invariant preservation against the Omnipresent Constitutional Charter.
 */
export function verifyOmnipresentConstitutionalInvariant(
  invariant: OmnipresentConstitutionalInvariant,
  proposedAction: string
): OmnipresentInvariantCheckOutput {
  return verifySingleConstitutionalInvariant(
    invariant,
    proposedAction,
    'Omnipresent'
  );
}

/**
 * Validates proposed changes against immutable omnipresent constitutional invariants.
 */
export function verifyOmnipresentConstitutionalInvariants(
  invariants: OmnipresentConstitutionalInvariant[],
  proposedTargetArticleCode: string
): OmnipresentInvariantCheckOutput {
  return verifyConstitutionalInvariantsList(
    invariants,
    proposedTargetArticleCode,
    'OMNIPRESENT_INVARIANT',
    'Omnipresent'
  );
}
