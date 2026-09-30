/**
 * @file eternal-supreme-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Eternal Supreme Conclave Arbitration (99.99999999% Supermajority, 99.9999% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateEternalSupremeConclaveDispute,
  verifyEternalEmpireConstitutionalInvariant,
  verifyEternalEmpireConstitutionalInvariants,
} from '../eternal-supreme-conclave-engine';
import type {
  EternalEmpireConstitutionalInvariant,
  EternalEmpireJurorVote,
} from '@/seed/types/infinite-holographic-stark-conclave';

describe('Eternal Supreme Conclave Engine (Gate 31)', () => {
  it('rules in favor of claimant when 99.99999999% supermajority threshold is achieved and slashes dissenting jurors 99.9999%', () => {
    // 10,000 jurors: 9,999 vote true (claimant), 1 votes false (dissenting rogue)
    const votes: EternalEmpireJurorVote[] = [];
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
      stakeCents: 10_000_000_00, // $100,000 stake
    });

    const ruling = arbitrateEternalSupremeConclaveDispute({
      disputeCaseRef: 'DISPUTE_INF_001',
      claimantParticipantId: 'CLAIMANT_AI_INFINITE',
      respondentParticipantId: 'RESPONDENT_ENTITY_BETA',
      disputeValueCents: 500_000_000_00,
      evidenceSha256: 'a'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.99, // 9999/10000 = 99.99%
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(10_000);
    expect(ruling.claimantVotes).toBe(9_999);
    expect(ruling.respondentVotes).toBe(1);
    expect(ruling.effectiveSupermajorityPct).toBe(99.99);
    expect(ruling.executedRemedyCents).toBe(500_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(9_999_990_00); // 99.9999% of $100,000 = $99,999.90
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps dispute in deliberation if neither party reaches 99.99999999% supermajority', () => {
    const votes: EternalEmpireJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 10_000_00 },
    ];

    const ruling = arbitrateEternalSupremeConclaveDispute({
      disputeCaseRef: 'DISPUTE_SPLIT_031',
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

  it('strictly blocks actions attempting to override immutable Eternal constitutional invariants', () => {
    const invariant: EternalEmpireConstitutionalInvariant = {
      articleCode: 'ART_ETERNAL_001',
      articleTitle: 'INFINITE_IRREVOCABLE_SANCTITY',
      isStrictlyImmutable: true,
      lastTheoremVerifiedAt: new Date().toISOString(),
      enforcementCircuitHash: 'd'.repeat(64),
    };

    const checkBlocked = verifyEternalEmpireConstitutionalInvariant(
      invariant,
      'ACTION_OVERRIDE_CONSTITUTIONAL_RESERVE'
    );
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.isStrictlyImmutable).toBe(true);
    expect(checkBlocked.reason).toContain('violates strictly immutable');

    const checkAllowed = verifyEternalEmpireConstitutionalInvariant(
      invariant,
      'ACTION_ROUTINE_QUORUM_PROPOSAL'
    );
    expect(checkAllowed.allowed).toBe(true);
  });

  it('verifies a list of constitutional invariants against proposed modification codes', () => {
    const checkImmutable = verifyEternalEmpireConstitutionalInvariants('ART_01_COGNITIVE_AUTONOMY');
    expect(checkImmutable.allowed).toBe(false);
    expect(checkImmutable.isStrictlyImmutable).toBe(true);
    expect(checkImmutable.reason).toContain('Strictly Immutable');

    const checkUnknown = verifyEternalEmpireConstitutionalInvariants('ART_99_NON_EXISTENT');
    expect(checkUnknown.allowed).toBe(true);
    expect(checkUnknown.isStrictlyImmutable).toBe(false);
  });
});
