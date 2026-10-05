/**
 * @file pan-cosmic-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Pan-Cosmic Constitutional Conclave Arbitration (98% Supermajority, 60% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
  verifyParameterizedConstitutionalInvariants,
} from './sovereign-conclave-domain-engine';
import type {
  PanCosmicConclaveVerdict,
  PanCosmicConstitutionalInvariant,
  PanCosmicJurorVote,
} from '@/seed/types/topological-braided-conclave';

export interface PanCosmicDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: PanCosmicJurorVote[];
  supermajorityThresholdPct?: number; // Default 98.0%
}

export interface PanCosmicDisputeRuling {
  disputeCaseRef: string;
  verdict: PanCosmicConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface PanCosmicInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and state disputes via Pan-Cosmic Constitutional Conclave.
 * Requires 98.0% supermajority consensus; penalizes dissenting rogue jurors with 60% stake slashing.
 */
export function arbitratePanCosmicDispute(input: PanCosmicDisputeInput): PanCosmicDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 98.0,
    slashingPenaltyPct: 60.0,
    slashingMultiplier: 0.60,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: () => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`PAN_COSMIC_RULING:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.executedRemedyCents}:${ctx.totalSlashedStakeCents}`)
        .digest('hex'),
  });

  return {
    disputeCaseRef: result.disputeCaseRef,
    verdict: result.verdict as PanCosmicConclaveVerdict,
    totalJurors: result.totalJurors,
    claimantVotes: result.claimantVotes,
    respondentVotes: result.respondentVotes,
    effectiveSupermajorityPct: result.effectiveSupermajorityPct ?? 0,
    jurorsSlashedCount: result.jurorsSlashedCount,
    totalSlashedStakeCents: result.totalSlashedStakeCents,
    executedRemedyCents: result.executedRemedyCents,
    rulingHash: result.rulingHash,
  };
}

/**
 * Validates proposed changes against immutable pan-cosmic constitutional invariants.
 */
export function verifyPanCosmicConstitutionalInvariants(
  invariants: PanCosmicConstitutionalInvariant[],
  proposedTargetArticleCode: string
): PanCosmicInvariantCheckOutput {
  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    proposedTargetArticleCode,
    undefined,
    { hashPrefix: 'PAN_COSMIC_INVARIANT' }
  );

  return {
    allowed: result.allowed,
    articleCode: result.articleCode,
    isStrictlyImmutable: result.isStrictlyImmutable,
    reason: result.reason,
    verificationHash: result.verificationHash ?? '',
  };
}
