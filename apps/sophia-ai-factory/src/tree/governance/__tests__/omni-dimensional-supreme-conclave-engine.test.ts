/**
 * @file omni-dimensional-supreme-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Omni-Dimensional Supreme Conclave Arbitration (99.9999% Supermajority, 99.9% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateOmniDimensionalConclaveDispute,
  verifyOmniDimensionalConstitutionalInvariant,
  verifyOmniDimensionalConstitutionalInvariants,
} from '../omni-dimensional-supreme-conclave-engine';
import type {
  OmniDimensionalConstitutionalInvariant,
  OmniDimensionalJurorVote,
} from '@/seed/types/omni-dimensional-stark-conclave';

describe('Omni-Dimensional Supreme Conclave Engine (Gate 27)', () => {
  it('rules in favor of claimant when 99.9999% supermajority threshold is achieved and slashes dissenting jurors 99.9%', () => {
    // 1,000,000 jurors: 999,999 vote true (claimant), 1 votes false (dissenting rogue)
    const votes: OmniDimensionalJurorVote[] = [];
    for (let i = 0; i < 999_999; i++) {
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

    const ruling = arbitrateOmniDimensionalConclaveDispute({
      disputeCaseRef: 'DISPUTE_OMNI_001',
      claimantParticipantId: 'CLAIMANT_AI_ETERNAL',
      respondentParticipantId: 'RESPONDENT_ENTITY_BETA',
      disputeValueCents: 100_000_000_00,
      evidenceSha256: 'a'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.9999,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(1_000_000);
    expect(ruling.claimantVotes).toBe(999_999);
    expect(ruling.respondentVotes).toBe(1);
    expect(ruling.effectiveSupermajorityPct).toBe(99.9999);
    expect(ruling.executedRemedyCents).toBe(100_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(9_990_000_00); // 99.9% of $100,000 = $99,900
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps dispute in deliberation if neither party reaches 99.9999% supermajority', () => {
    const votes: OmniDimensionalJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 10_000_00 },
    ];

    const ruling = arbitrateOmniDimensionalConclaveDispute({
      disputeCaseRef: 'DISPUTE_SPLIT_027',
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

  it('strictly blocks actions attempting to override immutable Omni-Dimensional constitutional invariants', () => {
    const invariant: OmniDimensionalConstitutionalInvariant = {
      articleCode: 'ART_ETERNAL_001',
      articleTitle: 'OMNI_DIMENSIONAL_IRREVOCABLE_SANCTITY',
      isStrictlyImmutable: true,
      lastTheoremVerifiedAt: new Date().toISOString(),
      enforcementCircuitHash: 'd'.repeat(64),
    };

    const checkBlocked = verifyOmniDimensionalConstitutionalInvariant(
      invariant,
      'ACTION_OVERRIDE_CONSTITUTIONAL_RESERVE'
    );
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.isStrictlyImmutable).toBe(true);
    expect(checkBlocked.reason).toContain('violates strictly immutable');

    const checkAllowed = verifyOmniDimensionalConstitutionalInvariant(
      invariant,
      'ACTION_ROUTINE_QUORUM_PROPOSAL'
    );
    expect(checkAllowed.allowed).toBe(true);
  });

  it('verifies a list of constitutional invariants against proposed modification codes', () => {
    const invariants: OmniDimensionalConstitutionalInvariant[] = [
      {
        articleCode: 'ART_CORE_01',
        articleTitle: 'Continuous Zero-Entropy Solvency',
        isStrictlyImmutable: true,
        lastTheoremVerifiedAt: new Date().toISOString(),
        enforcementCircuitHash: 'e'.repeat(64),
      },
      {
        articleCode: 'ART_FEE_02',
        articleTitle: 'Dynamic Shard Fee Adaptation',
        isStrictlyImmutable: false,
        lastTheoremVerifiedAt: new Date().toISOString(),
        enforcementCircuitHash: 'f'.repeat(64),
      },
    ];

    const immutableCheck = verifyOmniDimensionalConstitutionalInvariants(invariants, 'ART_CORE_01');
    expect(immutableCheck.allowed).toBe(false);
    expect(immutableCheck.isStrictlyImmutable).toBe(true);

    const mutableCheck = verifyOmniDimensionalConstitutionalInvariants(invariants, 'ART_FEE_02');
    expect(mutableCheck.allowed).toBe(true);
    expect(mutableCheck.isStrictlyImmutable).toBe(false);
  });
});
