/**
 * @file conclave-engine-shared-helpers.ts
 * @layer tree/governance
 * @description Shared calculation, ruling mapping, and constitutional invariant verification helpers for Supreme Conclave engines.
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
  type ConclaveDisputeInput,
} from './sovereign-conclave-domain-engine';

export interface SharedConstitutionalInvariant {
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash?: string;
}

export interface SharedInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

export interface SharedConclaveArbitrationConfig {
  defaultSupermajorityThresholdPct: number;
  slashingPenaltyPct: number;
  slashingMultiplier: number;
  rulingPrefix: string;
}

export function executeParameterizedConclaveRuling<TRuling>(
  input: ConclaveDisputeInput,
  config: SharedConclaveArbitrationConfig,
): TRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: config.defaultSupermajorityThresholdPct,
    slashingPenaltyPct: config.slashingPenaltyPct,
    slashingMultiplier: config.slashingMultiplier,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: () => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`${config.rulingPrefix}:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.executedRemedyCents}:${ctx.totalSlashedStakeCents}`)
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
  } as unknown as TRuling;
}

export function verifySingleConstitutionalInvariant(
  invariant: SharedConstitutionalInvariant,
  proposedAction: string,
  domainLabel: string,
): SharedInvariantCheckOutput {
  const { isStrictlyImmutable, articleCode, articleTitle } = invariant;
  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    return {
      allowed: false,
      articleCode,
      isStrictlyImmutable,
      reason: `Action violates strictly immutable ${domainLabel} constitutional article ${articleCode}: ${articleTitle}`,
      verificationHash: createHash('sha256').update(`CONSTITUTIONAL_BREACH_REJECTED:${articleCode}`).digest('hex'),
    };
  }
  return {
    allowed: true,
    articleCode,
    isStrictlyImmutable,
    verificationHash: createHash('sha256').update(`CONSTITUTIONAL_ACTION_PERMITTED:${articleCode}:${proposedAction}`).digest('hex'),
  };
}

export function verifyConstitutionalInvariantsList(
  invariants: SharedConstitutionalInvariant[],
  proposedTargetArticleCode: string,
  hashPrefix: string,
  domainLabel: string,
): SharedInvariantCheckOutput {
  const match = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);
  if (!match) {
    return {
      allowed: true,
      articleCode: proposedTargetArticleCode,
      isStrictlyImmutable: false,
      reason: 'Article not found in constitutional invariants charter; standard modification procedure applies',
      verificationHash: createHash('sha256').update(`INVARIANT_NOT_FOUND:${proposedTargetArticleCode}`).digest('hex'),
    };
  }
  const hash = createHash('sha256')
    .update(`${hashPrefix}:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash}`)
    .digest('hex');
  return match.isStrictlyImmutable
    ? {
        allowed: false,
        articleCode: match.articleCode,
        isStrictlyImmutable: true,
        reason: `Violation of ${domainLabel} Constitutional Invariant ${match.articleCode} ("${match.articleTitle}"): Strictly Immutable`,
        verificationHash: hash,
      }
    : { allowed: true, articleCode: match.articleCode, isStrictlyImmutable: false, verificationHash: hash };
}