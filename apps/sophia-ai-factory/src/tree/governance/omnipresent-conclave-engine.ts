/**
 * @file omnipresent-conclave-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Omnipresent Supreme Conclave Arbitration (99.95% Supermajority, 95% Slashing).
 */

import { createHash } from 'node:crypto';
import {
  arbitrateParameterizedConclaveDispute,
  verifyParameterizedConstitutionalInvariants,
} from './sovereign-conclave-domain-engine';

import type {
  OmnipresentConclaveVerdict,
  OmnipresentConstitutionalInvariant,
  OmnipresentJurorVote,
} from '@/seed/types/braided-stark-conclave';

export interface OmnipresentDisputeInput {
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  votes: OmnipresentJurorVote[];
  supermajorityThresholdPct?: number; // Default 99.95%
}

export interface OmnipresentDisputeRuling {
  disputeCaseRef: string;
  verdict: OmnipresentConclaveVerdict;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  rulingHash: string;
}

export interface OmnipresentInvariantCheckOutput {
  allowed: boolean;
  articleCode: string;
  isStrictlyImmutable: boolean;
  reason?: string;
  verificationHash: string;
}

/**
 * Arbitrates commercial, contract, and multiverse disputes via Omnipresent Supreme Conclave of Sovereign AI.
 * Requires 99.95% supermajority consensus; penalizes dissenting rogue jurors with 95% stake slashing.
 */
export function arbitrateOmnipresentConclaveDispute(
  input: OmnipresentDisputeInput
): OmnipresentDisputeRuling {
  const result = arbitrateParameterizedConclaveDispute(input, {
    defaultSupermajorityThresholdPct: 99.95,
    slashingPenaltyPct: 95.0,
    slashingMultiplier: 0.95,
    emptyVerdict: 'PENDING_EVIDENCE',
    emptyRulingHashFn: (input) => createHash('sha256').update('NO_VOTES').digest('hex'),
    rulingHashFn: (ctx) =>
      createHash('sha256')
        .update(`OMNIPRESENT_CONCLAVE_RULING:${ctx.disputeCaseRef}:${ctx.verdict}:${ctx.executedRemedyCents}:${ctx.totalSlashedStakeCents}`)
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
  } as unknown as OmnipresentDisputeRuling;
}

/**
 * Validates invariant preservation against the Omnipresent Constitutional Charter.
 */
export function verifyOmnipresentConstitutionalInvariant(
  invariant: OmnipresentConstitutionalInvariant,
  proposedAction: string
): OmnipresentInvariantCheckOutput {
  const isStrictlyImmutable = invariant.isStrictlyImmutable;

  if (isStrictlyImmutable && proposedAction.toUpperCase().includes('OVERRIDE_CONSTITUTIONAL')) {
    const rejectHash = createHash('sha256')
      .update(`CONSTITUTIONAL_BREACH_REJECTED:${invariant.articleCode}`)
      .digest('hex');

    return {
      allowed: false,
      articleCode: invariant.articleCode,
      isStrictlyImmutable,
      reason: `Action violates strictly immutable Omnipresent constitutional article ${invariant.articleCode}: ${invariant.articleTitle}`,
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

/**
 * Validates proposed changes against immutable omnipresent constitutional invariants.
 */
export function verifyOmnipresentConstitutionalInvariants(
  invariants: OmnipresentConstitutionalInvariant[],
  proposedTargetArticleCode: string
): OmnipresentInvariantCheckOutput {
  const match = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (!match) {
    const hash = createHash('sha256').update(`INVARIANT_NOT_FOUND:${proposedTargetArticleCode}`).digest('hex');
    return {
      allowed: true,
      articleCode: proposedTargetArticleCode,
      isStrictlyImmutable: false,
      reason: 'Article not found in constitutional invariants charter; standard modification procedure applies',
      verificationHash: hash,
    };
  }

  const hash = createHash('sha256')
    .update(`OMNIPRESENT_INVARIANT:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash}`)
    .digest('hex');

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Omnipresent Constitutional Invariant ${match.articleCode} ("${match.articleTitle}"): Strictly Immutable`,
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
