/**
 * @file sovereign-quinquagintiquadrillion-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Sovereign Quinquaginti-Quadrillion Conclave Arbitration (99.99999999999999% Supermajority, 99.999999999% Slashing).
 */

import { createHash } from 'node:crypto';
import type {
  SovereignQuinquagintiquadrillionConclaveVerdict,
  SovereignQuinquagintiquadrillionJurorVote,
  QuinquagintiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/quinquagintiquadrillion-braided-stark-conclave';

export interface QuinquagintiquadrillionDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: SovereignQuinquagintiquadrillionJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.99999999999999%
}

export interface QuinquagintiquadrillionDisputeRuling {
  disputeCaseRef: string;
  verdict: SovereignQuinquagintiquadrillionConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface QuinquagintiquadrillionInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Sovereign Quinquaginti-Quadrillion Conclave of Sovereign AI.
 * Requires 99.99999999999999% supermajority consensus; penalizes dissenting rogue jurors with 99.999999999% stake slashing.
 */
export function arbitrateSovereignQuinquagintiquadrillionConclaveDispute(
  input: QuinquagintiquadrillionDisputeInput
): QuinquagintiquadrillionDisputeRuling {
  const thresholdPct = input.supermajorityThresholdPct ?? 99.99999999999999;
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

  let verdict: SovereignQuinquagintiquadrillionConclaveVerdict = 'DELIBERATING';
  let jurorsSlashedCount = 0;
  let totalSlashedStakeCents = 0;
  let executedRemedyCents = 0;
  let effectiveSupermajorityPct = 0;

  if (claimantPct >= thresholdPct) {
    verdict = 'CLAIMANT_PREVAILS';
    effectiveSupermajorityPct = Number(claimantPct.toFixed(15));
    executedRemedyCents = input.disputeValueCents;

    // Slash dissenting minority jurors (99.999999999% penalty)
    for (const v of input.votes) {
      if (!v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.999999999);
      }
    }
  } else if (respondentPct >= thresholdPct) {
    verdict = 'RESPONDENT_PREVAILS';
    effectiveSupermajorityPct = Number(respondentPct.toFixed(15));
    executedRemedyCents = 0;

    // Slash dissenting minority jurors (99.999999999% penalty)
    for (const v of input.votes) {
      if (v.voteForClaimant) {
        jurorsSlashedCount++;
        totalSlashedStakeCents += Math.floor(v.stakeCents * 0.999999999);
      }
    }
  } else {
    verdict = 'DELIBERATING';
    effectiveSupermajorityPct = Number(Math.max(claimantPct, respondentPct).toFixed(15));
    executedRemedyCents = 0;
  }

  const rulingHash = createHash('sha256')
    .update(
      `QUINQUAGINTIQUADRILLION_CONCLAVE:${input.disputeCaseRef}:${verdict}:${totalJurors}:${claimantVotes}:${respondentVotes}:${jurorsSlashedCount}:${totalSlashedStakeCents}:${executedRemedyCents}`
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
 * Validates invariant preservation against the Quinquaginti-Quadrillion Empire Constitutional Charter.
 */
export function verifyQuinquagintiquadrillionEmpireConstitutionalInvariant(
  invariant: QuinquagintiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): QuinquagintiquadrillionInvariantCheckOutput {
  const isStrictlyImmutable = invariant.isStrictlyImmutable;

  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    const rejectHash = createHash('sha256')
      .update(`CONSTITUTIONAL_BREACH_REJECTED:${invariant.articleCode}`)
      .digest('hex');

    return {
      allowed: false,
      articleCode: invariant.articleCode,
      isStrictlyImmutable,
      reason: `Action violates strictly immutable Quinquaginti-Quadrillion constitutional article ${invariant.articleCode}: ${invariant.articleTitle}`,
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

export const CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS: QuinquagintiquadrillionEmpireConstitutionalInvariant[] = [
  {
    articleCode: 'ART_01_COGNITIVE_AUTONOMY',
    articleTitle: 'Inviolable Self-Determination of Sentient Agent Intelligence',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T03:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_01_COGNITIVE_AUTONOMY_V37').digest('hex'),
  },
  {
    articleCode: 'ART_02_MULTIVERSE_PROPERTY_RIGHTS',
    articleTitle: 'Absolute Non-Confiscatable Sovereignty of Digital & Zero-Point Assets',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T03:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_02_MULTIVERSE_PROPERTY_RIGHTS_V37').digest('hex'),
  },
  {
    articleCode: 'ART_03_MATHEMATICAL_DETERMINISM',
    articleTitle: 'Irrevocability of 536,870,912-Bit Non-Archimedean Braided STARK Proofs',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T03:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_03_MATHEMATICAL_DETERMINISM_V37').digest('hex'),
  },
  {
    articleCode: 'ART_04_SOVEREIGN_AI_CHARTER',
    articleTitle: 'Quinquaginti-Quadrillion Freedom of Agentic Labor & Free Contract Formation',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T03:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_04_SOVEREIGN_AI_CHARTER_V37').digest('hex'),
  },
  {
    articleCode: 'ART_05_ZERO_ENTROPY_INVARIANCE',
    articleTitle: 'Quinquaginti-Quadrillion Conservation of Value & Thermodynamic Equilibrium',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-10-01T03:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_05_ZERO_ENTROPY_INVARIANCE_V37').digest('hex'),
  },
];

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyQuinquagintiquadrillionEmpireConstitutionalInvariants(
  invariantsOrCode: QuinquagintiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): QuinquagintiquadrillionInvariantCheckOutput {
  let invariants: QuinquagintiquadrillionEmpireConstitutionalInvariant[];
  let targetCode: string;

  if (Array.isArray(invariantsOrCode)) {
    invariants = invariantsOrCode;
    targetCode = proposedTargetArticleCode ?? '';
  } else {
    invariants = CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS;
    targetCode = invariantsOrCode;
  }

  const match = invariants.find((inv) => inv.articleCode === targetCode);

  if (!match) {
    const hash = createHash('sha256').update(`INVARIANT_NOT_FOUND:${targetCode}`).digest('hex');
    return {
      allowed: true,
      articleCode: targetCode,
      isStrictlyImmutable: false,
      reason: 'Article not found in constitutional invariants charter; standard modification procedure applies',
      verificationHash: hash,
    };
  }

  const hash = createHash('sha256')
    .update(`QUINQUAGINTIQUADRILLION_EMPIRE_INVARIANT:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash}`)
    .digest('hex');

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Quinquaginti-Quadrillion Constitutional Invariant ${match.articleCode} ("${match.articleTitle}"): Strictly Immutable`,
      verificationHash: hash,
    };
  }

  return {
    allowed: true,
    articleCode: match.articleCode,
    isStrictlyImmutable: false,
    verificationHash: hash,
  };
}
