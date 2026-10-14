/**
 * @file sovereign-ducentiquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Ducenti-Quadrillion Conclave Arbitration (99.9999999999999999% Supermajority, 99.999999999% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';
import {
  verifyParameterizedConstitutionalInvariants,
} from './conclave';
import {
  CANONICAL_DUCENTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  checkConstitutionalActionPermitted,
} from './conclave-engine-canonical-invariants';

export {
  CANONICAL_DUCENTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from './conclave-engine-canonical-invariants';

import type {
  SovereignDucentiquadrillionConclaveVerdict,
  SovereignDucentiquadrillionJurorVote,
  DucentiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/ducentiquadrillion-braided-stark-conclave';

export interface DucentiquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignDucentiquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.9999999999999999%
}

export interface DucentiquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignDucentiquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface DucentiquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Ducenti-Quadrillion Conclave of Sovereign AI.
 * Requires 99.9999999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999999% stake slashing.
 */
export function arbitrateSovereignDucentiquadrillionConclaveDispute(
  input: DucentiquadrillionDisputeInput
): DucentiquadrillionDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.9999999999999999,
    slashingPenaltyPct: 99.9999999,
    slashingMultiplier: 0.999999999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`DUCENTIQUADRILLION_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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
  } as unknown as DucentiquadrillionDisputeRuling;
}

/**
 * Validates invariant preservation against the Ducenti-Quadrillion Empire Constitutional Charter.
 */
export function verifyDucentiquadrillionEmpireConstitutionalInvariant(
  invariant: DucentiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): DucentiquadrillionInvariantCheckOutput {
  return checkConstitutionalActionPermitted(
    invariant.articleCode,
    invariant.articleTitle,
    invariant.isStrictlyImmutable,
    proposedAction,
    'Ducenti-Quadrillion',
  );
}

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyDucentiquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: DucentiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): DucentiquadrillionInvariantCheckOutput {
  const invariants = Array.isArray(invariantsOrCode)
    ? invariantsOrCode
    : CANONICAL_DUCENTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
  const targetCode = Array.isArray(invariantsOrCode)
    ? (proposedTargetArticleCode ?? "")
    : invariantsOrCode;

  const result = verifyParameterizedConstitutionalInvariants(
    invariants,
    targetCode,
    undefined,
    {
      hashPrefix: 'DUCENTIQUADRILLION_EMPIRE_INVARIANT',
      reasonPrefix: 'Ducenti-Quadrillion',
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
