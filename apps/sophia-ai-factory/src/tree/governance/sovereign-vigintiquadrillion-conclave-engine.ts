/**
 * @file sovereign-vigintiquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Viginti-Quadrillion Conclave Arbitration (99.9999999999999% Supermajority, 99.999999999% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_VIGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_VIGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignVigintiquadrillionConclaveVerdict,
  SovereignVigintiquadrillionJurorVote,
  VigintiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/vigintiquadrillion-braided-stark-conclave';

export interface VigintiquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignVigintiquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9999999999999%
}

export interface VigintiquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignVigintiquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface VigintiquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Viginti-Quadrillion Conclave of Sovereign AI.
 * Requires 99.9999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999999% stake slashing.
 */
export function arbitrateSovereignVigintiquadrillionConclaveDispute(
  input: VigintiquadrillionDisputeInput
): VigintiquadrillionDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.9999999999999,
    slashingPenaltyPct: 99.9999999,
    slashingMultiplier: 0.999999999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`VIGINTIQUADRILLION_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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
  } as unknown as VigintiquadrillionDisputeRuling;
}

/**
 * Validates invariant preservation against the Viginti-Quadrillion Empire Constitutional Charter.
 */
export function verifyVigintiquadrillionEmpireConstitutionalInvariant(
  invariant: VigintiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): VigintiquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Viginti-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyVigintiquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: VigintiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): VigintiquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_VIGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? "")
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'VIGINTIQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Viginti-Quadrillion',
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
