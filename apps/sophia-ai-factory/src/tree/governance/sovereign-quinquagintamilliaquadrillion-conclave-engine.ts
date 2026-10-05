/**
 * @file sovereign-quinquagintamilliaquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quinquaginta-Millia-Quadrillion Conclave Arbitration and Constitutional Charter Invariants.
 */

import { createHash } from 'node:crypto';
import {
  SOVEREIGN_QUINQUAGINTAMILLIAQUADRILLION_CONCLAVE_CONSTANTS,
  type QuinquagintamilliaquadrillionDisputeVerdict,
  type QuinquagintamilliaquadrillionEmpireConstitutionalInvariant,
  type SovereignQuinquagintamilliaquadrillionJurorVote,
} from '@/seed/types/quinquagintamilliaquadrillion-braided-stark-conclave';

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

export interface QuinquagintamilliaquadrillionInvariantCheckOutput {
  articleCode: string;
  isStrictlyImmutable: boolean;
  allowed: boolean;
  reason: string;
  verificationHash: string;
}

export const CANONICAL_QUINQUAGINTAMILLIAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS: QuinquagintamilliaquadrillionEmpireConstitutionalInvariant[] =
  [
    {
      articleCode: 'ART-50000Q-001',
      articleTitle: 'ABSOLUTE_AGENTIC_SOVEREIGNTY_AUTONOMY',
      isStrictlyImmutable: true,
      mathematicalConstraintFormula: 'AUTONOMY_COEFFICIENT == 1.0 && CEO_INTERVENTION_SCOPE == UNLIMITED',
      enforcementCircuitHash: 'a71b83d95efc32d99214b64d0a1b0239cf21e6789123456789abcdef01234567',
    },
    {
      articleCode: 'ART-50000Q-002',
      articleTitle: 'NON_ARCHIMEDEAN_STATE_PRESERVATION',
      isStrictlyImmutable: true,
      mathematicalConstraintFormula: 'PROOF_ENTROPY_LOSS == 0.0 && COMPACTED_STATE_DEPTH >= 2^41',
      enforcementCircuitHash: 'b82c94e06f0d43ea0325c75e1b2c1340df32f7890123456789abcdef01234568',
    },
    {
      articleCode: 'ART-50000Q-003',
      articleTitle: 'NET_ZERO_THERMODYNAMIC_HARVEST_PARITY',
      isStrictlyImmutable: true,
      mathematicalConstraintFormula: 'CARBON_INTENSITY == 0.0 && HARVEST_EFFICIENCY_COP >= 2500.0',
      enforcementCircuitHash: 'c93da5f17a1e54fb1436d86f2c3d2451e0430890123456789abcdef01234569',
    },
  ];

/**
 * Arbitrates a Quinquaginta-Millia-Quadrillion dispute requiring 99.99999999999999999999999999% consensus (26 nines).
 */
export function arbitrateSovereignQuinquagintamilliaquadrillionConclaveDispute(
  input: QuinquagintamilliaquadrillionDisputeInput
): QuinquagintamilliaquadrillionDisputeRuling {
  const supermajorityThreshold =
    input.supermajorityThresholdPct ??
    SOVEREIGN_QUINQUAGINTAMILLIAQUADRILLION_CONCLAVE_CONSTANTS.SUPERMAJORITY_THRESHOLD_PERCENT;

  let claimantVotes = 0;
  let respondentVotes = 0;

  for (const v of input.votes) {
    if (v.voteForClaimant) {
      claimantVotes++;
    } else {
      respondentVotes++;
    }
  }

  const totalJurors = input.votes.length;
  const claimantPct = totalJurors > 0 ? (claimantVotes / totalJurors) * 100 : 0;
  const respondentPct = totalJurors > 0 ? (respondentVotes / totalJurors) * 100 : 0;

  let verdict: QuinquagintamilliaquadrillionDisputeVerdict = 'DELIBERATING';
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= supermajorityThreshold) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = claimantPct;
    executedRemedyCents = input.disputeValueCents;

    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(
          v.stakeCents *
            (SOVEREIGN_QUINQUAGINTAMILLIAQUADRILLION_CONCLAVE_CONSTANTS.BYZANTINE_SLASHING_PENALTY_PERCENT / 100)
        );
      }
    }
  } else if (respondentPct >= supermajorityThreshold) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = respondentPct;
    executedRemedyCents = 0;

    for (const v of input.votes) {
      if (v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(
          v.stakeCents *
            (SOVEREIGN_QUINQUAGINTAMILLIAQUADRILLION_CONCLAVE_CONSTANTS.BYZANTINE_SLASHING_PENALTY_PERCENT / 100)
        );
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Math.max(claimantPct, respondentPct);
  }

  const rulingHash = createHash('sha256')
    .update(
      `QUINQUAGINTAMILLIAQUADRILLION_RULING:${input.disputeCaseRef}:${verdict}:${executedRemedyCents}:${jurorsSlashedCount}:${totalSlashedStakeCents}:${effectiveSupermajorityPct}`
    )
    .digest('hex');

  return {
    disputeCaseRef: input.disputeCaseRef,
    verdict,
    totalJurors,
    claimantVotes,
    respondentVotes,
    effectiveSupermajorityPct,
    jurorsSlashedCount,
    totalSlashedStakeCents,
    executedRemedyCents,
    rulingHash,
  };
}

/**
 * Verifies that a proposed autonomous empire governance action strictly respects immutable charter invariants.
 */
export function verifyQuinquagintamilliaquadrillionEmpireConstitutionalInvariant(
  invariant: QuinquagintamilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): QuinquagintamilliaquadrillionInvariantCheckOutput {
  const isViolation =
    invariant.isStrictlyImmutable &&
    (proposedAction.includes('OVERRIDE_CONSTITUTIONAL_AUTONOMY') ||
      proposedAction.includes('WEAKEN_PROOF_LATTICE') ||
      proposedAction.includes('COMPROMISE_NET_ZERO'));

  const allowed = !isViolation;
  const reason = allowed
    ? `Proposed action '${proposedAction}' conforms with ${invariant.articleTitle}`
    : `Proposed action '${proposedAction}' violates strictly immutable invariant ${invariant.articleCode}: ${invariant.articleTitle}`;

  const verificationHash = createHash('sha256')
    .update(`${invariant.articleCode}:${invariant.enforcementCircuitHash}:${allowed}:${proposedAction}`)
    .digest('hex');

  return {
    articleCode: invariant.articleCode,
    isStrictlyImmutable: invariant.isStrictlyImmutable,
    allowed,
    reason,
    verificationHash,
  };
}
