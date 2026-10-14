/**
 * @file sovereign-biquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Bi-Quadrillion Conclave Arbitration (99.9999999999% Supermajority, 99.999999% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_BIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-supreme-invariants';

export {
  CANONICAL_BIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-supreme-invariants';

import type {
  SovereignBiquadrillionConclaveVerdict,
  SovereignBiquadrillionJurorVote,
  BiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/biquadrillion-braided-stark-conclave';

export interface BiquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignBiquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9999999999%
}

export interface BiquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignBiquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface BiquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Bi-Quadrillion Conclave of Sovereign AI.
 * Requires 99.9999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999% stake slashing.
 */
export function arbitrateSovereignBiquadrillionConclaveDispute(
  input: BiquadrillionDisputeInput
): BiquadrillionDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.9999999999,
    slashingPenaltyPct: 99.99999899999999,
    slashingMultiplier: 0.99999999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`BIQUADRILLION_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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
  } as unknown as BiquadrillionDisputeRuling;
}

/**
 * Validates invariant preservation against the Bi-Quadrillion Empire Constitutional Charter.
 */
export function verifyBiquadrillionEmpireConstitutionalInvariant(
  invariant: BiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): BiquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Bi-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyBiquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: BiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): BiquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_BIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? "")
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'BIQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Bi-Quadrillion',
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
