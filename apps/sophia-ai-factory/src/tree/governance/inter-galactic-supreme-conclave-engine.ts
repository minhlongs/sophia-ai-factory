/**
 * @file inter-galactic-supreme-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Omni-Cosmic Supreme Conclave Arbitration (99.99999% Supermajority, 99.95% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
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
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.99999,
    slashingPenaltyPct: 99.95,
    slashingMultiplier: 0.9995,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`INTER_GALACTIC_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
        .digest('hex'),
  });

  return {
    disputeCaseRef: result.disputeCaseRef,
    verdict: result.verdict as unknown as string,
    totalJurors: result.totalJurors, totalSenators: result.totalSenators, totalDirectors: result.totalDirectors,
    claimantVotes: result.claimantVotes, respondentVotes: result.respondentVotes,
    effectiveSupermajorityPct: result.effectiveSupermajorityPct ?? 0,
    achievedSupermajorityPct: result.achievedSupermajorityPct ?? 0,
    jurorsSlashedCount: result.jurorsSlashedCount,
    senatorsSlashedCount: result.senatorsSlashedCount,
    directorsSlashedCount: result.directorsSlashedCount,
    totalSlashedStakeCents: result.totalSlashedStakeCents,
    executedRemedyCents: result.executedRemedyCents,
    rulingHash: result.rulingHash,
  } as unknown as InterGalacticDisputeRuling;
}

/**
 * Validates invariant preservation against the Inter-Galactic Constitutional Charter.
 */
export function verifyInterGalacticConstitutionalInvariant(
  invariant: InterGalacticConstitutionalInvariant,
  proposedAction: string
): InterGalacticInvariantCheckOutput {
  const isStrictlyImmutable = invariant.isStrictlyImmutable;

  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    const rejectHash = createHash('sha256').update(`CONSTITUTIONAL_BREACH_REJECTED:${invariant.articleCode}`).digest('hex');
    return {
      allowed: false, articleCode: invariant.articleCode, isStrictlyImmutable,
      reason: `Action violates strictly immutable Omni-Cosmic constitutional article ${invariant.articleCode}: ${invariant.articleTitle}`,
      verificationHash: rejectHash,
    };
  }

  const allowHash = createHash('sha256').update(`CONSTITUTIONAL_ACTION_PERMITTED:${invariant.articleCode}:${proposedAction}`).digest('hex');
  return { allowed: true, articleCode: invariant.articleCode, isStrictlyImmutable, verificationHash: allowHash };
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

