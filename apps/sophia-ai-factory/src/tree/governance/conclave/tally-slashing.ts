/**
 * @file tally-slashing.ts
 * @layer tree/governance/conclave
 * @description Vote tallying and slashing calculation helpers for Sovereign Conclave Arbitration.
 */

import { createHash } from 'node:crypto';
import type {
  ConclaveJurorVote,
  ConclaveDisputeInput,
  ConclaveArbitrationConfig,
  ConclaveDisputeRuling,
} from './types';

export function resolveSlashingMultiplier(
  config: ConclaveArbitrationConfig,
  slashingPenaltyPct: number
): number {
  if (config.slashingMultiplier !== undefined) {
    return config.slashingMultiplier;
  }
  return slashingPenaltyPct <= 1.0 ? slashingPenaltyPct : slashingPenaltyPct / 100;
}

export function createEmptyConclaveRuling(
  input: ConclaveDisputeInput,
  config: ConclaveArbitrationConfig
): ConclaveDisputeRuling {
  const verdict = config.emptyVerdict ?? 'PENDING_EVIDENCE';
  const rulingHash = config.emptyRulingHashFn
    ? config.emptyRulingHashFn(input)
    : createHash('sha256').update(config.emptyHashTag ?? 'NO_VOTES').digest('hex');
  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict,
    totalJurors: 0,
    totalSenators: 0,
    totalDirectors: 0,
    claimantVotes: 0,
    respondentVotes: 0,
    effectiveSupermajorityPct: 0,
    achievedSupermajorityPct: 0,
    jurorsSlashedCount: 0,
    senatorsSlashedCount: 0,
    directorsSlashedCount: 0,
    totalSlashedStakeCents: 0,
    executedRemedyCents: 0,
    rulingHash,
  };
}

export function tallyConclaveVotes(
  votes: ConclaveJurorVote[]
): { claimantVotes: number; respondentVotes: number } {
  let claimantVotes = 0;
  let respondentVotes = 0;
  for (const v of votes) {
    if (v.voteForClaimant) {
      claimantVotes++;
    } else {
      respondentVotes++;
    }
  }
  return { claimantVotes, respondentVotes };
}

export function calculateConclaveSlashing(
  votes: ConclaveJurorVote[],
  slashDissentersOfClaimant: boolean,
  multiplier: number
): { jurorsSlashedCount: number; totalSlashedStakeCents: number } {
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  for (const v of votes) {
    const shouldSlash = slashDissentersOfClaimant ? !v.voteForClaimant : v.voteForClaimant;
    if (shouldSlash) {
      jurorsSlashedCount++;
      totalSlashedStakeCents += Math.floor(v.stakeCents * multiplier);
    }
  }
  return { jurorsSlashedCount, totalSlashedStakeCents };
}
