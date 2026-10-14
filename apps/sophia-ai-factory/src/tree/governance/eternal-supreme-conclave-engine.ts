/**
 * @file eternal-supreme-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Eternal Supreme Conclave Arbitration (99.99999999% Supermajority, 99.9999% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
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
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.99999999,
    slashingPenaltyPct: 99.9999,
    slashingMultiplier: 0.999999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`ETERNAL_SUPREME_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
        .digest('hex'),
  });

  return {
    disputeCaseRef: result.disputeCaseRef,
    verdict: result.verdict as unknown as string,
    totalJurors: result.totalJurors,
    totalSenators: result.totalSenators,
    totalDirectors: result.totalDirectors,
    claimantVotes: result.claimantVotes,
    respondentVotes: result.respondentVotes,
    effectiveSupermajorityPct: result.effectiveSupermajorityPct ?? 0,
    achievedSupermajorityPct: result.achievedSupermajorityPct ?? 0,
    jurorsSlashedCount: result.jurorsSlashedCount,
    senatorsSlashedCount: result.senatorsSlashedCount,
    directorsSlashedCount: result.directorsSlashedCount,
    totalSlashedStakeCents: result.totalSlashedStakeCents,
    executedRemedyCents: result.executedRemedyCents,
    rulingHash: result.rulingHash,
  } as unknown as EternalEmpireDisputeRuling;
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
