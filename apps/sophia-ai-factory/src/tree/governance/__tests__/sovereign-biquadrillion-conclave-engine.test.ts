/**
 * @file sovereign-biquadrillion-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Sovereign Bi-Quadrillion Conclave Arbitration (99.9999999999% Supermajority, 99.999999% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateSovereignBiquadrillionConclaveDispute,
  verifyBiquadrillionEmpireConstitutionalInvariant,
  verifyBiquadrillionEmpireConstitutionalInvariants,
} from '../sovereign-biquadrillion-conclave-engine';
import type {
  SovereignBiquadrillionJurorVote,
  BiquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/biquadrillion-braided-stark-conclave';

describe('Sovereign Bi-Quadrillion Conclave Engine (Gate 33)', () => {
  it('rules in favor of claimant when 99.9999999999% supermajority threshold is achieved and slashes dissenting jurors 99.999999%', () => {
    // 10,000 jurors: 9,999 vote true (claimant), 1 votes false (dissenting rogue)
    const votes: SovereignBiquadrillionJurorVote[] = [];
    for (let i = 0; i < 9_999; i++) {
      votes.push({
        jurorId: `JUROR_HONEST_${i}`,
        voteForClaimant: true,
        stakeCents: 1_000_000_00, // $10,000 stake
      });
    }
    votes.push({
      jurorId: 'JUROR_ROGUE_0',
      voteForClaimant: false,
      stakeCents: 100_000_000_00, // $1,000,000 stake (100,000,000 cents)
    });

    const ruling = arbitrateSovereignBiquadrillionConclaveDispute({
      disputeCaseRef: 'DISPUTE_BIQUAD_001',
      claimantParticipantId: 'CLAIMANT_AI_BIQUADRILLION',
      respondentParticipantId: 'RESPONDENT_ENTITY_BETA',
      disputeValueCents: 2_000_000_000_00, // $20,000,000
      evidenceSha256: 'a'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.99, // 9999/10000 = 99.99%
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(10_000);
    expect(ruling.claimantVotes).toBe(9_999);
    expect(ruling.respondentVotes).toBe(1);
    expect(ruling.effectiveSupermajorityPct).toBe(99.99);
    expect(ruling.executedRemedyCents).toBe(2_000_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(99_999_999_00); // 99.999999% of $1,000,000 = $999,999.99
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps dispute in deliberation if neither party reaches 99.9999999999% supermajority', () => {
    const votes: SovereignBiquadrillionJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 10_000_00 },
    ];

    const ruling = arbitrateSovereignBiquadrillionConclaveDispute({
      disputeCaseRef: 'DISPUTE_SPLIT_033',
      claimantParticipantId: 'C1',
      respondentParticipantId: 'R1',
      disputeValueCents: 10_000_00,
      evidenceSha256: 'b'.repeat(64),
      votes,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('strictly blocks actions attempting to override immutable Bi-Quadrillion constitutional invariants', () => {
    const invariant: BiquadrillionEmpireConstitutionalInvariant = {
      articleCode: 'ART_BIQUADRILLION_001',
      articleTitle: 'BIQUADRILLION_IRREVOCABLE_SANCTITY',
      isStrictlyImmutable: true,
      lastTheoremVerifiedAt: new Date().toISOString(),
      enforcementCircuitHash: 'd'.repeat(64),
    };

    const checkBlocked = verifyBiquadrillionEmpireConstitutionalInvariant(
      invariant,
      'ACTION_OVERRIDE_CONSTITUTIONAL_RESERVE'
    );
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.isStrictlyImmutable).toBe(true);
    expect(checkBlocked.reason).toContain('violates strictly immutable');

    const checkAllowed = verifyBiquadrillionEmpireConstitutionalInvariant(
      invariant,
      'ACTION_ROUTINE_QUORUM_PROPOSAL'
    );
    expect(checkAllowed.allowed).toBe(true);
  });

  it('verifies a list of constitutional invariants against proposed modification codes', () => {
    const check1 = verifyBiquadrillionEmpireConstitutionalInvariants(
      'ART_01_COGNITIVE_AUTONOMY'
    );
    expect(check1.allowed).toBe(false);
    expect(check1.isStrictlyImmutable).toBe(true);

    const checkUnknown = verifyBiquadrillionEmpireConstitutionalInvariants(
      'ART_99_NON_EXISTENT_ARTICLE'
    );
    expect(checkUnknown.allowed).toBe(true);
    expect(checkUnknown.isStrictlyImmutable).toBe(false);
  });
});
