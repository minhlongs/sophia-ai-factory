/**
 * @file arbitrate-dispute.ts
 * @layer tree/governance/conclave
 * @description Parameterized dispute arbitration execution for Sovereign Conclave.
 */

import type {
  ConclaveDisputeInput,
  ConclaveArbitrationConfig,
  ConclaveDisputeRuling,
  ConclaveRulingContext,
} from './types';
import {
  resolveSlashingMultiplier,
  createEmptyConclaveRuling,
  tallyConclaveVotes,
} from './tally-slashing';
import { evaluateConclaveOutcome, computeConclaveRulingHash } from './outcome-evaluator';

export function arbitrateParameterizedConclaveDispute(
  input: ConclaveDisputeInput,
  config: ConclaveArbitrationConfig = {}
): ConclaveDisputeRuling {
  const thresholdPct =
    input.supermajorityThresholdPct ?? config.defaultSupermajorityThresholdPct ?? 98.0;
  const slashingPenaltyPct = config.slashingPenaltyPct ?? 60.0;
  const slashingMultiplier = resolveSlashingMultiplier(config, slashingPenaltyPct);
  const totalJurors = input.votes.length;

  if (totalJurors === 0) {
    return createEmptyConclaveRuling(input, config);
  }

  const { claimantVotes, respondentVotes } = tallyConclaveVotes(input.votes);
  const claimantPct = (claimantVotes / totalJurors) * 100;
  const respondentPct = (respondentVotes / totalJurors) * 100;

  const precision = Math.max(
    2,
    thresholdPct.toString().includes('.') ? (thresholdPct.toString().split('.')[1]?.length ?? 2) : 2
  );

  const outcome = evaluateConclaveOutcome(
    input,
    claimantPct,
    respondentPct,
    thresholdPct,
    precision,
    slashingMultiplier
  );

  const rulingContext: ConclaveRulingContext = {
    disputeCaseRef: input.disputeCaseRef,
    verdict: outcome.verdict,
    totalJurors,
    claimantVotes,
    respondentVotes,
    effectiveSupermajorityPct: outcome.effectiveSupermajorityPct,
    jurorsSlashedCount: outcome.jurorsSlashedCount,
    totalSlashedStakeCents: outcome.totalSlashedStakeCents,
    executedRemedyCents: outcome.executedRemedyCents,
    thresholdPct,
    slashingPenaltyPct,
  };

  const rulingHash = computeConclaveRulingHash(input, rulingContext, config);

  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict: outcome.verdict,
    totalJurors,
    totalSenators: totalJurors,
    totalDirectors: totalJurors,
    claimantVotes,
    respondentVotes,
    effectiveSupermajorityPct: outcome.effectiveSupermajorityPct,
    achievedSupermajorityPct: outcome.effectiveSupermajorityPct,
    jurorsSlashedCount: outcome.jurorsSlashedCount,
    senatorsSlashedCount: outcome.jurorsSlashedCount,
    directorsSlashedCount: outcome.jurorsSlashedCount,
    totalSlashedStakeCents: outcome.totalSlashedStakeCents,
    executedRemedyCents: outcome.executedRemedyCents,
    rulingHash,
  };
}
