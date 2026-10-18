/**
 * @file pan-dimensional-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Pan-Dimensional Supreme Conclave Arbitration (99.9% Supermajority, 90% Slashing).
 */

import {
  executeParameterizedConclaveRuling,
  verifyConstitutionalInvariantsList,
  verifySingleConstitutionalInvariant,
} from './conclave-engine-shared-helpers';

import type {
  PanDimensionalConclaveVerdict,
  PanDimensionalConstitutionalInvariant,
  PanDimensionalJurorVote,
} from '@/seed/types/topological-stark-conclave';

export interface PanDimensionalDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: PanDimensionalJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9%
}

export interface PanDimensionalDisputeRuling {
  disputeCaseRef: string;
  verdict: PanDimensionalConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface PanDimensionalInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Pan-Dimensional Supreme Conclave of Sovereign AI.
 * Requires 99.9% supermajority consensus; penalizes dissenting rogue jurors with 90% stake slashing.
 */
export function arbitratePanDimensionalConclaveDispute(
  input: PanDimensionalDisputeInput
): PanDimensionalDisputeRuling {
  return executeParameterizedConclaveRuling<PanDimensionalDisputeRuling>(
    input,
    {
      defaultSupermajorityThresholdPct: 99.9,
      slashingPenaltyPct: 90.0,
      slashingMultiplier: 0.90,
      rulingPrefix: 'PAN_DIMENSIONAL_CONCLAVE_RULING',
    }
  );
}

/**
 * Validates invariant preservation against the Pan-Dimensional Constitutional Charter.
 */
export function verifyPanDimensionalConstitutionalInvariant(
  invariant: PanDimensionalConstitutionalInvariant,
  proposedAction: string
): PanDimensionalInvariantCheckOutput {
  return verifySingleConstitutionalInvariant(
    invariant,
    proposedAction,
    'Pan-Dimensional'
  );
}

/**
 * Validates proposed changes against immutable pan-dimensional constitutional invariants.
 */
export function verifyPanDimensionalConstitutionalInvariants(
  invariants: PanDimensionalConstitutionalInvariant[],
  proposedTargetArticleCode: string
): PanDimensionalInvariantCheckOutput {
  return verifyConstitutionalInvariantsList(
    invariants,
    proposedTargetArticleCode,
    'PAN_DIMENSIONAL_INVARIANT',
    'Pan-Dimensional'
  );
}
