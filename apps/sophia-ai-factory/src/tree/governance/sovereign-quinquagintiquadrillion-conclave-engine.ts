/**
 * @file sovereign-quinquagintiquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quinquaginti-Quadrillion Conclave Arbitration (99.99999999999999% Supermajority, 99.999999999% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignQuinquagintiquadrillionConclaveVerdict,
  SovereignQuinquagintiquadrillionJurorVote,
  QuinquagintiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/quinquagintiquadrillion-braided-stark-conclave';

export interface QuinquagintiquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignQuinquagintiquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.99999999999999%
}

export interface QuinquagintiquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignQuinquagintiquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface QuinquagintiquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Quinquaginti-Quadrillion Conclave of Sovereign AI.
 * Requires 99.99999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999999% stake slashing.
 */
export function arbitrateSovereignQuinquagintiquadrillionConclaveDispute(
  input: QuinquagintiquadrillionDisputeInput
): QuinquagintiquadrillionDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.99999999999999,
    slashingPenaltyPct: 99.9999999,
    slashingMultiplier: 0.999999999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`QUINQUAGINTIQUADRILLION_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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
  } as unknown as QuinquagintiquadrillionDisputeRuling;
}

/**
 * Validates invariant preservation against the Quinquaginti-Quadrillion Empire Constitutional Charter.
 */
export function verifyQuinquagintiquadrillionEmpireConstitutionalInvariant(
  invariant: QuinquagintiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): QuinquagintiquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Quinquaginti-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyQuinquagintiquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: QuinquagintiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): QuinquagintiquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? "")
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'QUINQUAGINTIQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Quinquaginti-Quadrillion',
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
