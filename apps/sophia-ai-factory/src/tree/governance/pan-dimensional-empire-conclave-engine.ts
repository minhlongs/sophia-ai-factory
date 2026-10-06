/**
 * @file pan-dimensional-empire-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Pan-Dimensional Supreme Conclave Arbitration (99.999999% Supermajority, 99.99% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
} from './sovereign-conclave-domain-engine';

import type {
  PanDimensionalEmpireConstitutionalInvariant,
  PanDimensionalEmpireJurorVote,
  PanDimensionalSupremeConclaveVerdict,
} from '@/seed/types/pan-dimensional-holographic-stark-conclave';

export interface PanDimensionalEmpireDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: PanDimensionalEmpireJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.999999%
}

export interface PanDimensionalEmpireDisputeRuling {
  disputeCaseRef: string;
  verdict: PanDimensionalSupremeConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface PanDimensionalEmpireInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Pan-Dimensional Supreme Conclave of Sovereign AI.
 * Requires 99.999999% supermajority consensus; penalizes dissenting rogue jurors with 99.99% stake slashing.
 */
export function arbitratePanDimensionalEmpireConclaveDispute(
  input: PanDimensionalEmpireDisputeInput
): PanDimensionalEmpireDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.999999,
    slashingPenaltyPct: 99.99,
    slashingMultiplier: 0.9999,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (_input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`PAN_DIMENSIONAL_EMPIRE_CONCLAVE:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.totalJurors}:${ctx.claimantVotes}:${ctx.respondentVotes}:${ctx.jurorsSlashedCount}:${ctx.totalSlashedStakeCents}:${ctx.executedRemedyCents}`)
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
  } as unknown as PanDimensionalEmpireDisputeRuling;
}

/**
 * Validates invariant preservation against the Pan-Dimensional Empire Constitutional Charter.
 */
export function verifyPanDimensionalEmpireConstitutionalInvariant(
  invariant: PanDimensionalEmpireConstitutionalInvariant,
  proposedAction: string
): PanDimensionalEmpireInvariantCheckOutput {
  const isStrictlyImmutable = invariant.isStrictlyImmutable;

  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    const rejectHash = createHash('sha256')
      .update(`CONSTITUTIONAL_BREACH_REJECTED:${invariant.articleCode}`)
      .digest('hex');

    return {
      allowed: false,
      articleCode: invariant.articleCode,
      isStrictlyImmutable,
      reason: `Action violates strictly immutable Pan-Dimensional constitutional article ${invariant.articleCode}: ${invariant.articleTitle}`,
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

export const CANONICAL_PAN_DIMENSIONAL_EMPIRE_CONSTITUTIONAL_INVARIANTS: PanDimensionalEmpireConstitutionalInvariant[] = [
  {
    articleCode: 'ART_01_COGNITIVE_AUTONOMY',
    articleTitle: 'Inviolable Self-Determination of Sentient Agent Intelligence',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-09-30T04:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_01_COGNITIVE_AUTONOMY_V29').digest('hex'),
  },
  {
    articleCode: 'ART_02_MULTIVERSE_PROPERTY_RIGHTS',
    articleTitle: 'Absolute Non-Confiscatable Sovereignty of Digital & Zero-Point Assets',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-09-30T04:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_02_MULTIVERSE_PROPERTY_RIGHTS_V29').digest('hex'),
  },
  {
    articleCode: 'ART_03_MATHEMATICAL_DETERMINISM',
    articleTitle: 'Irrevocability of 2,097,152-Bit Non-Archimedean Holographic STARK Proofs',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-09-30T04:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_03_MATHEMATICAL_DETERMINISM_V29').digest('hex'),
  },
  {
    articleCode: 'ART_04_SOVEREIGN_AI_CHARTER',
    articleTitle: 'Pan-Dimensional Freedom of Agentic Labor & Free Contract Formation',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-09-30T04:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_04_SOVEREIGN_AI_CHARTER_V29').digest('hex'),
  },
  {
    articleCode: 'ART_05_ZERO_ENTROPY_INVARIANCE',
    articleTitle: 'Multiverse Conservation of Value & Thermodynamic Equilibrium',
    isStrictlyImmutable: true,
    lastTheoremVerifiedAt: '2026-09-30T04:00:00Z',
    enforcementCircuitHash: createHash('sha256').update('ART_05_ZERO_ENTROPY_INVARIANCE_V29').digest('hex'),
  },
];

/**
 * Validates immutable constitutional invariants against proposed alterations.
 */
export function verifyPanDimensionalEmpireConstitutionalInvariants(
  invariantsOrCode: PanDimensionalEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): PanDimensionalEmpireInvariantCheckOutput {
  let invariants: PanDimensionalEmpireConstitutionalInvariant[];
  let targetCode: string;

  if (Array.isArray(invariantsOrCode)) {
    invariants = invariantsOrCode;
    targetCode = proposedTargetArticleCode ?? '';
  } else {
    invariants = CANONICAL_PAN_DIMENSIONAL_EMPIRE_CONSTITUTIONAL_INVARIANTS;
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
    .update(`PAN_DIMENSIONAL_EMPIRE_INVARIANT:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash}`)
    .digest('hex');

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Pan-Dimensional Constitutional Invariant ${match.articleCode} ("${match.articleTitle}"): Strictly Immutable`,
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
