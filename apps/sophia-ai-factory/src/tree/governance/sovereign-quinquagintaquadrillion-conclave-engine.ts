/**
 * @file sovereign-quinquagintaquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quinquaginta-Quadrillion Conclave Arbitration (99.99999999999999999% Supermajority, 99.9999999999% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_QUINQUAGINTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_QUINQUAGINTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignQuinquagintaquadrillionConclaveVerdict,
  SovereignQuinquagintaquadrillionJurorVote,
  QuinquagintaquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/quinquagintaquadrillion-braided-stark-conclave';

export interface QuinquagintaquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignQuinquagintaquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.99999999999999999%
}

export interface QuinquagintaquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignQuinquagintaquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface QuinquagintaquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Quinquaginta-Quadrillion Conclave of Sovereign AI.
 * Requires 99.99999999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.9999999999% stake slashing.
 */
export function arbitrateSovereignQuinquagintaquadrillionConclaveDispute(
  input: QuinquagintaquadrillionDisputeInput
): QuinquagintaquadrillionDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.99999999999999999,
    slashingPenaltyPct: 99.99999998999999,
    slashingMultiplier: 0.9999999999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`QUINQUAGINTAQUADRILLION_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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
  } as unknown as QuinquagintaquadrillionDisputeRuling;
}

/**
 * Validates invariant preservation against the Quinquaginta-Quadrillion Empire Constitutional Charter.
 */
export function verifyQuinquagintaquadrillionEmpireConstitutionalInvariant(
  invariant: QuinquagintaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): QuinquagintaquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Quinquaginta-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyQuinquagintaquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: QuinquagintaquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): QuinquagintaquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_QUINQUAGINTAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? "")
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'QUINQUAGINTAQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Quinquaginta-Quadrillion',
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
