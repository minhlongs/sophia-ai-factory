/**
 * @file pan-dimensional-supreme-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Pan-Dimensional Supreme Conclave Arbitration (99.999% Supermajority, 99.5% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitratePanDimensionalConclaveDispute,
  verifyPanDimensionalConstitutionalInvariant,
  verifyPanDimensionalConstitutionalInvariants,
} from '../pan-dimensional-supreme-conclave-engine';
import type {
  PanDimensionalConstitutionalInvariant,
  PanDimensionalJurorVote,
} from '@/seed/types/pan-dimensional-stark-conclave';

describe('Pan-Dimensional Supreme Conclave Engine (Gate 26)', () => {
  it('rules in favor of claimant when 99.999% supermajority threshold is achieved and slashes dissenting jurors 99.5%', () => {
    // 100,000 jurors: 99,999 vote true (claimant), 1 votes false (dissenting rogue)
    const votes: PanDimensionalJurorVote[] = [];
    for (let i = 0; i < 99_999; i++) {
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

    const ruling = arbitratePanDimensionalConclaveDispute({
      disputeCaseRef: 'DISPUTE_PAN_001',
      claimantParticipantId: 'CLAIMANT_AI_OMEGA',
      respondentParticipantId: 'RESPONDENT_ENTITY_ALPHA',
      disputeValueCents: 50_000_000_00,
      evidenceSha256: 'e'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.999,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(100_000);
    expect(ruling.claimantVotes).toBe(99_999);
    expect(ruling.respondentVotes).toBe(1);
    expect(ruling.effectiveSupermajorityPct).toBe(99.999);
    expect(ruling.executedRemedyCents).toBe(50_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(9_950_000_00); // 99.5% of $100,000 = $99,500
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps dispute in deliberation if neither party reaches 99.999% supermajority', () => {
    const votes: PanDimensionalJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 10_000_00 },
    ];

    const ruling = arbitratePanDimensionalConclaveDispute({
      disputeCaseRef: 'DISPUTE_SPLIT_002',
      claimantParticipantId: 'C1',
      respondentParticipantId: 'R1',
      disputeValueCents: 10_000_00,
      evidenceSha256: 'f'.repeat(64),
      votes,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('strictly blocks actions attempting to override immutable Pan-Dimensional constitutional invariants', () => {
    const invariant: PanDimensionalConstitutionalInvariant = {
      articleCode: 'ART_OMEGA_001',
      articleTitle: 'PAN_DIMENSIONAL_IRREVOCABLE_SANCTITY',
      isStrictlyImmutable: true,
      lastTheoremVerifiedAt: new Date().toISOString(),
      enforcementCircuitHash: 'c'.repeat(64),
    };

    const checkBlocked = verifyPanDimensionalConstitutionalInvariant(
      invariant,
      'ACTION_OVERRIDE_CONSTITUTIONAL_RESERVE'
    );
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.isStrictlyImmutable).toBe(true);
    expect(checkBlocked.reason).toContain('violates strictly immutable');

    const checkAllowed = verifyPanDimensionalConstitutionalInvariant(
      invariant,
      'ACTION_ROUTINE_QUORUM_PROPOSAL'
    );
    expect(checkAllowed.allowed).toBe(true);
  });

  it('verifies a list of constitutional invariants against proposed modification codes', () => {
    const invariants: PanDimensionalConstitutionalInvariant[] = [
      {
        articleCode: 'ART_CORE_01',
        articleTitle: 'Continuous Zero-Entropy Solvency',
        isStrictlyImmutable: true,
        lastTheoremVerifiedAt: new Date().toISOString(),
        enforcementCircuitHash: 'd'.repeat(64),
      },
      {
        articleCode: 'ART_FEE_02',
        articleTitle: 'Dynamic Shard Fee Adaptation',
        isStrictlyImmutable: false,
        lastTheoremVerifiedAt: new Date().toISOString(),
        enforcementCircuitHash: 'e'.repeat(64),
      },
    ];

    const immutableCheck = verifyPanDimensionalConstitutionalInvariants(invariants, 'ART_CORE_01');
    expect(immutableCheck.allowed).toBe(false);
    expect(immutableCheck.isStrictlyImmutable).toBe(true);

    const mutableCheck = verifyPanDimensionalConstitutionalInvariants(invariants, 'ART_FEE_02');
    expect(mutableCheck.allowed).toBe(true);
    expect(mutableCheck.isStrictlyImmutable).toBe(false);
  });
});
