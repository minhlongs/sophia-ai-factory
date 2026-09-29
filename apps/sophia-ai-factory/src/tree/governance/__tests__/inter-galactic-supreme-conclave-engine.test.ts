/**
 * @file inter-galactic-supreme-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Omni-Cosmic Supreme Conclave Arbitration (99.99999% Supermajority, 99.95% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateInterGalacticConclaveDispute,
  verifyInterGalacticConstitutionalInvariant,
  verifyInterGalacticConstitutionalInvariants,
} from '../inter-galactic-supreme-conclave-engine';
import type {
  InterGalacticConstitutionalInvariant,
  InterGalacticJurorVote,
} from '@/seed/types/inter-galactic-stark-conclave';

describe('Omni-Cosmic Supreme Conclave Engine (Gate 28)', () => {
  it('rules in favor of claimant when 99.99999% supermajority threshold is achieved and slashes dissenting jurors 99.95%', () => {
    // 10,000,000 jurors: 9,999,999 vote true (claimant), 1 votes false (dissenting rogue)
    const votes: InterGalacticJurorVote[] = [];
    for (let i = 0; i < 9_999_999; i++) {
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

    const ruling = arbitrateInterGalacticConclaveDispute({
      disputeCaseRef: 'DISPUTE_IG_001',
      claimantParticipantId: 'CLAIMANT_AI_ETERNAL',
      respondentParticipantId: 'RESPONDENT_ENTITY_BETA',
      disputeValueCents: 200_000_000_00,
      evidenceSha256: 'a'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.99999,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(10_000_000);
    expect(ruling.claimantVotes).toBe(9_999_999);
    expect(ruling.respondentVotes).toBe(1);
    expect(ruling.effectiveSupermajorityPct).toBe(99.99999);
    expect(ruling.executedRemedyCents).toBe(200_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(9_995_000_00); // 99.95% of $100,000 = $99,950
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps dispute in deliberation if neither party reaches 99.99999% supermajority', () => {
    const votes: InterGalacticJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 10_000_00 },
    ];

    const ruling = arbitrateInterGalacticConclaveDispute({
      disputeCaseRef: 'DISPUTE_SPLIT_028',
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

  it('strictly blocks actions attempting to override immutable Inter-Galactic constitutional invariants', () => {
    const invariant: InterGalacticConstitutionalInvariant = {
      articleCode: 'ART_ETERNAL_001',
      articleTitle: 'INTER_GALACTIC_IRREVOCABLE_SANCTITY',
      isStrictlyImmutable: true,
      lastTheoremVerifiedAt: new Date().toISOString(),
      enforcementCircuitHash: 'd'.repeat(64),
    };

    const checkBlocked = verifyInterGalacticConstitutionalInvariant(
      invariant,
      'ACTION_OVERRIDE_CONSTITUTIONAL_RESERVE'
    );
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.isStrictlyImmutable).toBe(true);
    expect(checkBlocked.reason).toContain('violates strictly immutable');

    const checkAllowed = verifyInterGalacticConstitutionalInvariant(
      invariant,
      'ACTION_ROUTINE_QUORUM_PROPOSAL'
    );
    expect(checkAllowed.allowed).toBe(true);
  });

  it('verifies a list of constitutional invariants against proposed modification codes', () => {
    const invariants: InterGalacticConstitutionalInvariant[] = [
      {
        articleCode: 'ART_01_COGNITIVE_AUTONOMY',
        articleTitle: 'Inviolable Self-Determination of Sentient Agent Intelligence',
        isStrictlyImmutable: true,
        lastTheoremVerifiedAt: '2026-09-29T14:00:00Z',
        enforcementCircuitHash: 'e'.repeat(64),
      },
      {
        articleCode: 'ART_PARAM_09',
        articleTitle: 'Adjustable Network Fee Coefficient',
        isStrictlyImmutable: false,
        lastTheoremVerifiedAt: '2026-09-29T14:00:00Z',
        enforcementCircuitHash: 'f'.repeat(64),
      },
    ];

    const immutableCheck = verifyInterGalacticConstitutionalInvariants(
      invariants,
      'ART_01_COGNITIVE_AUTONOMY'
    );
    expect(immutableCheck.allowed).toBe(false);
    expect(immutableCheck.isStrictlyImmutable).toBe(true);

    const mutableCheck = verifyInterGalacticConstitutionalInvariants(
      invariants,
      'ART_PARAM_09'
    );
    expect(mutableCheck.allowed).toBe(true);
    expect(mutableCheck.isStrictlyImmutable).toBe(false);
  });
});
