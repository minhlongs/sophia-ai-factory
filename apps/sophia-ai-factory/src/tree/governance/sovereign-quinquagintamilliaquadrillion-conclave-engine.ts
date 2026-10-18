/**
 * @file sovereign-quinquagintamilliaquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quinquaginta-Millia-Quadrillion Conclave Arbitration and Constitutional Charter Invariants.
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';

import {
  SOVEREIGN_QUINQUAGINTAMILLIAQUADRILLION_CONCLAVE_CONSTANTS,
  type QuinquagintamilliaquadrillionDisputeVerdict,
  type SovereignQuinquagintamilliaquadrillionJurorVote,
} from '@/seed/types/quinquagintamilliaquadrillion-braided-stark-conclave';

export {
  CANONICAL_QUINQUAGINTAMILLIAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  verifyQuinquagintamilliaquadrillionEmpireConstitutionalInvariant,
  type QuinquagintamilliaquadrillionInvariantCheckOutput,
} from './sovereign-quinquagintamilliaquadrillion-conclave-invariants';

export interface QuinquagintamilliaquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignQuinquagintamilliaquadrillionJurorVote[];
  supermajorityThresholdPct?: number;
}

export interface QuinquagintamilliaquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: QuinquagintamilliaquadrillionDisputeVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

/**
 * Arbitrates a Quinquaginta-Millia-Quadrillion dispute requiring 99.99999999999999999999999999% consensus (26 nines).
 */
export function arbitrateSovereignQuinquagintamilliaquadrillionConclaveDispute(
  input: QuinquagintamilliaquadrillionDisputeInput
): QuinquagintamilliaquadrillionDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: SOVEREIGN_QUINQUAGINTAMILLIAQUADRILLION_CONCLAVE_CONSTANTS.SUPERMAJORITY_THRESHOLD_PERCENT,
    slashingPenaltyPct: SOVEREIGN_QUINQUAGINTAMILLIAQUADRILLION_CONCLAVE_CONSTANTS.BYZANTINE_SLASHING_PENALTY_PERCENT,
    slashingMultiplier: SOVEREIGN_QUINQUAGINTAMILLIAQUADRILLION_CONCLAVE_CONSTANTS.BYZANTINE_SLASHING_PENALTY_PERCENT / 100,
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`QUINQUAGINTAMILLIAQUADRILLION_RULING:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.executedRemedyCents}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.effectiveSupermajorityPct}`)
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
  } as unknown as QuinquagintamilliaquadrillionDisputeRuling;
}
