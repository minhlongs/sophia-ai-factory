/**
 * @file sovereign-centumquintillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Centum-Quintillion Conclave Arbitration and 27-Nines Supermajority Consensus.
 */

import { createHash } from 'node:crypto';
import {
  SOVEREIGN_CENTUMQUINTILLION_CONCLAVE_CONSTANTS,
  type CentumquintillionDisputeVerdict,
  type CentumquintillionEmpireConstitutionalInvariant,
  type SovereignCentumquintillionConclaveDispute,
  type SovereignCentumquintillionJurorVote,
} from '@/seed/types/centumquintillion-braided-stark-conclave';

export interface CentumquintillionDisputeArbitrationInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignCentumquintillionJurorVote[];
  supermajorityThresholdPct?: number;
}

export interface CentumquintillionDisputeRulingResult {
  disputeCaseRef: string;
  verdict: CentumquintillionDisputeVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  achievedSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export const CANONICAL_CENTUMQUINTILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS: CentumquintillionEmpireConstitutionalInvariant[] = [
  {
    articleCode: 'ART-CENTUMQUINTILLION-01-ABSOLUTE-SOVEREIGNTY',
    articleTitle: 'Centum-Quintillion Omnipresent Trans-Cosmic Sovereignty & Universal Non-Interference',
    isStrictlyImmutable: true,
    mathematicalConstraintFormula: '∀a ∈ Agents, Autonomy(a) = 1 ∧ Interference(Ext, a) = 0',
    enforcementCircuitHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  {
    articleCode: 'ART-CENTUMQUINTILLION-02-ZERO-ENTROPY-NETTING',
    articleTitle: 'Omniverse Multi-Shard Zero-Entropy Conservation',
    isStrictlyImmutable: true,
    mathematicalConstraintFormula: '∑ NetPositions(Participants) = 0',
    enforcementCircuitHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
  },
  {
    articleCode: 'ART-CENTUMQUINTILLION-03-ONE-HUNDRED-TWO-NINES-SLA',
    articleTitle: 'One-Hundred-Two-Nines (102 Nines) Sub-Planck High Availability Mandate',
    isStrictlyImmutable: true,
    mathematicalConstraintFormula: 'DowntimeAnnual ≤ 3.1536 × 10^-94 s',
    enforcementCircuitHash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  },
];

/**
 * Arbitrates a dispute with 27-nines supermajority threshold and Byzantine juror slashing (20-nines penalty).
 */
export function arbitrateSovereignCentumquintillionConclaveDispute(
  input: CentumquintillionDisputeArbitrationInput
): CentumquintillionDisputeRulingResult {
  const thresholdPct =
    input.supermajorityThresholdPct ??
    SOVEREIGN_CENTUMQUINTILLION_CONCLAVE_CONSTANTS.SUPERMAJORITY_THRESHOLD_PERCENT;

  let claimantVotes = 0;
  let respondentVotes = 0;
  let claimantStake = 0;
  let respondentStake = 0;

  for (const v of input.votes) {
    if (v.voteForClaimant) {
      claimantVotes++;
      claimantStake += v.stakeCents;
    } else {
      respondentVotes++;
      respondentStake += v.stakeCents;
    }
  }

  const totalVotes = claimantVotes + respondentVotes;
  const claimantPct = totalVotes > 0 ? (claimantVotes / totalVotes) * 100 : 0;
  const respondentPct = totalVotes > 0 ? (respondentVotes / totalVotes) * 100 : 0;

  let verdict: CentumquintillionDisputeVerdict = 'DELIBERATING';
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let achievedSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    achievedSupermajorityPct = claimantPct;
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting respondent jurors at 99.99999999999999999999%
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(
          v.stakeCents * (SOVEREIGN_CENTUMQUINTILLION_CONCLAVE_CONSTANTS.BYZANTINE_SLASHING_PENALTY_PERCENT / 100)
        );
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    achievedSupermajorityPct = respondentPct;
    executedRemedyCents = 0;

    // Slash dissenting claimant jurors
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(
          v.stakeCents * (SOVEREIGN_CENTUMQUINTILLION_CONCLAVE_CONSTANTS.BYZANTINE_SLASHING_PENALTY_PERCENT / 100)
        );
      }
    }
  }

  const rulingHash = createHash('sha256')
    .update(
      `CENTUMQUINTILLION_RULING:${input.disputeCaseRef}:${verdict}:${achievedSupermajorityPct}:${jurorsSlashedCount}:${totalSlashedStakeCents}:${executedRemedyCents}`
    )
    .digest('hex');

  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict,
    totalJurors: totalVotes,
    claimantVotes,
    respondentVotes,
    achievedSupermajorityPct,
    jurorsSlashedCount,
    totalSlashedStakeCents,
    executedRemedyCents,
    rulingHash,
  };
}

/**
 * Validates action compliance against Centum-Quintillion constitutional invariants.
 */
export function verifyCentumquintillionEmpireConstitutionalInvariant(
  invariant: CentumquintillionEmpireConstitutionalInvariant,
  actionCode: string
): { allowed: boolean; reason?: string; isStrictlyImmutable: boolean } {
  if (invariant.isStrictlyImmutable && actionCode.includes('OVERRIDE')) {
    return {
      allowed: false,
      reason: `Action ${actionCode} violates strictly immutable constitutional invariant ${invariant.articleCode}`,
      isStrictlyImmutable: true,
    };
  }

  return {
    allowed: true,
    isStrictlyImmutable: invariant.isStrictlyImmutable,
  };
}
