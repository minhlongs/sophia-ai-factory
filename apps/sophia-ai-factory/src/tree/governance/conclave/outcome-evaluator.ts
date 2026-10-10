/**
 * @file outcome-evaluator.ts
 * @layer tree/governance/conclave
 * @description Conclave outcome evaluation and cryptographic ruling hash computation.
 */

import { createHash } from 'node:crypto';
import type {
  ConclaveDisputeInput,
  ConclaveRulingContext,
  ConclaveArbitrationConfig,
} from './types';
import { calculateConclaveSlashing } from './tally-slashing';

export function evaluateConclaveOutcome(
  input: ConclaveDisputeInput,
  claimantPct: number,
  respondentPct: number,
  thresholdPct: number,
  precision: number,
  slashingMultiplier: number
): {
  verdict: string;
  effectiveSupermajorityPct: number;
  executedRemedyCents: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
} {
  if (claimantPct >= thresholdPct) {
    const slashing = calculateConclaveSlashing(input.votes, true, slashingMultiplier);
    return {
      verdict: 'CLAIMANT_PREVAILS',
      effectiveSupermajorityPct: Number(claimantPct.toFixed(precision)),
      executedRemedyCents: input.disputeValueCents,
      ...slashing,
    };
  }
  if (respondentPct >= thresholdPct) {
    const slashing = calculateConclaveSlashing(input.votes, false, slashingMultiplier);
    return {
      verdict: 'RESPONDENT_PREVAILS',
      effectiveSupermajorityPct: Number(respondentPct.toFixed(precision)),
      executedRemedyCents: 0,
      ...slashing,
    };
  }
  return {
    verdict: 'DELIBERATING',
    effectiveSupermajorityPct: Number(Math.max(claimantPct, respondentPct).toFixed(precision)),
    executedRemedyCents: 0,
    jurorsSlashedCount: 0,
    totalSlashedStakeCents: 0,
  };
}

export function computeConclaveRulingHash(
  input: ConclaveDisputeInput,
  rulingContext: ConclaveRulingContext,
  config: ConclaveArbitrationConfig
): string {
  if (config.rulingHashFn) {
    return config.rulingHashFn(rulingContext);
  }
  const prefix = config.hashPrefix ?? 'CONCLAVE_RULING';
  return createHash('sha256')
    .update(
      `${prefix}:${input.disputeCaseRef}:${rulingContext.verdict}:${rulingContext.executedRemedyCents}:${rulingContext.totalSlashedStakeCents}`
    )
    .digest('hex');
}
