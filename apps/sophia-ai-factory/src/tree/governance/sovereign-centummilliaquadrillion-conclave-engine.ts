/**
 * @file sovereign-centummilliaquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Centummillia-Quadrillion Conclave Arbitration (99.999999999999999999% Supermajority, 99.99999999999% Slashing).
 */

import { createHash } from 'node:crypto';
import type {
  SovereignCentummilliaquadrillionConclaveVerdict,
  SovereignCentummilliaquadrillionJurorVote,
  CentummilliaquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/centummilliaquadrillion-braided-stark-conclave';

export interface CentummilliaquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignCentummilliaquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.999999999999999999% (18 nines)
}

export interface CentummilliaquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignCentummilliaquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface CentummilliaquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Centummillia-Quadrillion Conclave of Sovereign AI.
 * Requires 99.999999999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.99999999999% stake slashing.
 */
export function arbitrateSovereignCentummilliaquadrillionConclaveDispute(
  input: CentummilliaquadrillionDisputeInput
): CentummilliaquadrillionDisputeRuling {
  const thresholdPct = input.supermajorityThresholdPct ?? 99.999999999999999999;
  const totalJurors = input.votes.length;

  if (totalJurors === 0) {
    const emptyHash = createHash('sha256').update('NO_VOTES').digest('hex');
    return {
      disputeCaseRef: input.disputeCaseRef,
      verdict: 'PENDING_EVIDENCE',
      totalJurors: 0,
      claimantVotes: 0,
      respondentVotes: 0,
      effectiveSupermajorityPct: 0,
      jurorsSlashedCount: 0,
      totalSlashedStakeCents: 0,
      executedRemedyCents: 0,
      rulingHash: emptyHash,
    };
  }

  let claimantVotes = 0;
  let respondentVotes = 0;

  for (const v of input.votes) {
    if (v.voteForClaimant) {
      claimantVotes++;
    } else {
      respondentVotes++;
    }
  }

  const claimantPct = (claimantVotes / totalJurors) * 100;
  const respondentPct = (respondentVotes / totalJurors) * 100;

  let verdict: SovereignCentummilliaquadrillionConclaveVerdict = 'DELIBERATING';
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = Number(claimantPct.toFixed(18));
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting minority jurors (99.99999999999% penalty)
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.99999999999);
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = Number(respondentPct.toFixed(18));
    executedRemedyCents = 0;

    // Slash dissenting minority jurors (99.99999999999% penalty)
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.99999999999);
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Number(Math.max(claimantPct, respondentPct).toFixed(18));
    executedRemedyCents = 0;
  }

  const rulingHash = createHash('sha256')
    .update(
      `CENTUMMILLIAQUADRILLION_CONCLAVE:${input.disputeCaseRef}:${verdict}:${totalJurors}:${claimantVotes}:${respondentVotes}:${jurorsSlashedCount}:${totalSlashedStakeCents}:${executedRemedyCents}`
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
 * Validates invariant preservation against the Centummillia-Quadrillion Empire Constitutional Charter.
 */
export function verifyCentummilliaquadrillionEmpireConstitutionalInvariant(
  invariant: CentummilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): CentummilliaquadrillionInvariantCheckOutput {
  const isStrictlyImmutable = invariant.isStrictlyImmutable;

  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    const rejectHash = createHash('sha256')
      .update(`CONSTITUTIONAL_BREACH_REJECTED:${invariant.articleCode}`)
      .digest('hex');

    return {
      allowed: false,
      articleCode: invariant.articleCode,
      isStrictlyImmutable,
      reason: `Action violates strictly immutable Centummillia-Quadrillion constitutional article ${invariant.articleCode}: ${invariant.articleTitle}`,
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

export const CANONICAL_CENTUMMILLIAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS: CentummilliaquadrillionEmpireConstitutionalInvariant[] = [
  {
    articleCode: 'ART_01_COGNITIVE_AUTONOMY',
    articleTitle: 'Inviolable Self-Determination of Sentient Agent Intelligence',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T06:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_01_COGNITIVE_AUTONOMY_V41').digest('hex'),
  },
  {
    articleCode: 'ART_02_MULTIVERSE_PROPERTY_RIGHTS',
    articleTitle: 'Absolute Non-Confiscatable Sovereignty of Digital & Zero-Point Assets',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T06:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_02_MULTIVERSE_PROPERTY_RIGHTS_V41').digest('hex'),
  },
  {
    articleCode: 'ART_03_MATHEMATICAL_DETERMINISM',
    articleTitle: 'Irrevocability of 8,589,934,592-Bit Non-Archimedean Braided STARK Proofs',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T06:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_03_MATHEMATICAL_DETERMINISM_V41').digest('hex'),
  },
  {
    articleCode: 'ART_04_SOVEREIGN_AI_CHARTER',
    articleTitle: 'Centummillia-Quadrillion Freedom of Agentic Labor & Free Contract Formation',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T06:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_04_SOVEREIGN_AI_CHARTER_V41').digest('hex'),
  },
  {
    articleCode: 'ART_05_TRANSPARENT_SOLVENCY',
    articleTitle: 'Basel XXXI $1,000.0Q Reserve Singularity Invariance & Solvency Proof',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T06:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_05_TRANSPARENT_SOLVENCY_V41').digest('hex'),
  },
];
