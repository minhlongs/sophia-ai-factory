/**
 * @file sovereign-quadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quadrillion Conclave Arbitration (99.999999999% Supermajority, 99.99999% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_QUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_QUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignQuadrillionConclaveVerdict,
  SovereignQuadrillionJurorVote,
  QuadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/quadrillion-holographic-stark-conclave';

export interface QuadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignQuadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.999999999%
}

export interface QuadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignQuadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface QuadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Quadrillion Conclave of Sovereign AI.
 * Requires 99.999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.99999% stake slashing.
 */
export function arbitrateSovereignQuadrillionConclaveDispute(
  input: QuadrillionDisputeInput
): QuadrillionDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.999999999,
    slashingPenaltyPct: 99.99999000000001,
    slashingMultiplier: 0.9999999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`QUADRILLION_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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
  } as unknown as QuadrillionDisputeRuling;
}

/**
 * Validates invariant preservation against the Quadrillion Empire Constitutional Charter.
 */
export function verifyQuadrillionEmpireConstitutionalInvariant(
  invariant: QuadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): QuadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyQuadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: QuadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): QuadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_QUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? "")
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'QUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Quadrillion',
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
