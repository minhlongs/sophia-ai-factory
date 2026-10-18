/**
 * @file sovereign-conclave-shared-math.ts
 * @layer tree/governance
 * @description Shared dispute arbitration and constitutional invariant verification math for Sovereign Quadrillion-tier Conclave engines.
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
  type ConclaveDisputeInput,
} from './sovereign-conclave-domain-engine';

export interface SovereignQuadrillionDisputeConfig {
  conclavePrefix: string;
  defaultSupermajorityThresholdPct: number;
  slashingPenaltyPct: number;
  slashingMultiplier: number;
}

export interface SovereignConstitutionalInvariantShape {
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  lastTheoremVerifiedAt: string;
  enforcementCircuitHash: string;
}

export interface SovereignInvariantCheckResult {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

export function executeQuadrillionConclaveArbitration<TRuling>(
  input: ConclaveDisputeInput,
  config: SovereignQuadrillionDisputeConfig,
): TRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: config.defaultSupermajorityThresholdPct,
    slashingPenaltyPct: config.slashingPenaltyPct,
    slashingMultiplier: config.slashingMultiplier,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: () => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`${config.conclavePrefix}:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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

export function verifyQuadrillionConstitutionalInvariant(
  invariant: SovereignConstitutionalInvariantShape,
  proposedAction: string,
  tierLabel: string,
): SovereignInvariantCheckResult {
  const isStrictlyImmutable = invariant.isStrictlyImmutable;

  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    const rejectHash = createHash('sha256')
      .update(`CONSTITUTIONAL_BREACH_REJECTED:${invariant.articleCode}`)
      .digest('hex');

    return {
      allowed: false,
      articleCode: invariant.articleCode,
      isStrictlyImmutable,
      reason: `Action violates strictly immutable ${tierLabel} constitutional article ${invariant.articleCode}: ${invariant.articleTitle}`,
      verificationHash: rejectHash,
    };
  }

  const allowHash = createHash('sha256')
    .update(`CONSTITUTIONAL_ACTION_PERMITTED:${invariant.articleCode}:${proposedAction}`)
    .digest('hex');

  return {
    allowed: true,
    articleCode: invariant.articleCode,
    isStrictlyImmutable,
    verificationHash: allowHash,
  };
}
