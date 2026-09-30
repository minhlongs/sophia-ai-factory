/**
 * @file sovereign-pentaquadrillion-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Sovereign Penta-Quadrillion Conclave Arbitration (99.99999999999% Supermajority, 99.9999999% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateSovereignPentaquadrillionConclaveDispute,
  verifyPentaquadrillionEmpireConstitutionalInvariant,
  verifyPentaquadrillionEmpireConstitutionalInvariants,
} from '../sovereign-pentaquadrillion-conclave-engine';
import type {
  SovereignPentaquadrillionJurorVote,
  PentaquadrillionEmpireConstitutionalInvariant,
} from '@/seed/types/pentaquadrillion-braided-stark-conclave';

describe('Sovereign Penta-Quadrillion Conclave Engine (Gate 34)', () => {
  it('rules in favor of claimant when supermajority threshold is achieved and slashes dissenting jurors 99.9999999%', () => {
    // 10,000 jurors: 9,999 vote true (claimant), 1 votes false (dissenting rogue)
    const votes: SovereignPentaquadrillionJurorVote[] = [];
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
      stakeCents: 100_000_000_00, // $1,000,000 stake (10,000,000,000 cents)
    });

    const ruling = arbitrateSovereignPentaquadrillionConclaveDispute({
      disputeCaseRef: 'DISPUTE_PENTA_001',
      claimantParticipantId: 'CLAIMANT_AI_PENTAQUADRILLION',
      respondentParticipantId: 'RESPONDENT_ENTITY_BETA',
      disputeValueCents: 5_000_000_000_00, // $50,000,000
      evidenceSha256: 'a'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.99, // 9999/10000 = 99.99%
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(10_000);
    expect(ruling.claimantVotes).toBe(9_999);
    expect(ruling.respondentVotes).toBe(1);
    expect(ruling.effectiveSupermajorityPct).toBe(99.99);
    expect(ruling.executedRemedyCents).toBe(5_000_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(99_999_999_90); // 99.9999999% of $1,000,000
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps dispute in deliberation if neither party reaches supermajority', () => {
    const votes: SovereignPentaquadrillionJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 10_000_00 },
    ];

    const ruling = arbitrateSovereignPentaquadrillionConclaveDispute({
      disputeCaseRef: 'DISPUTE_SPLIT_034',
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

  it('strictly blocks actions attempting to override immutable Penta-Quadrillion constitutional invariants', () => {
    const invariant: PentaquadrillionEmpireConstitutionalInvariant = {
      articleCode: 'ART_PENTAQUADRILLION_001',
      articleTitle: 'PENTAQUADRILLION_IRREVOCABLE_SANCTITY',
      isStrictlyImmutable: true,
      lastTheoremVerifiedAt: new Date().toISOString(),
      enforcementCircuitHash: 'd'.repeat(64),
    };

    const checkBlocked = verifyPentaquadrillionEmpireConstitutionalInvariant(
      invariant,
      'ACTION_OVERRIDE_CONSTITUTIONAL_RESERVE'
    );
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.isStrictlyImmutable).toBe(true);
    expect(checkBlocked.reason).toContain('violates strictly immutable');

    const checkAllowed = verifyPentaquadrillionEmpireConstitutionalInvariant(
      invariant,
      'ACTION_ROUTINE_QUORUM_PROPOSAL'
    );
    expect(checkAllowed.allowed).toBe(true);
  });

  it('verifies a list of constitutional invariants against proposed modification codes', () => {
    const check1 = verifyPentaquadrillionEmpireConstitutionalInvariants(
      'ART_01_COGNITIVE_AUTONOMY'
    );
    expect(check1.allowed).toBe(false);
    expect(check1.isStrictlyImmutable).toBe(true);

    const checkUnknown = verifyPentaquadrillionEmpireConstitutionalInvariants(
      'ART_99_NON_EXISTENT_ARTICLE'
    );
    expect(checkUnknown.allowed).toBe(true);
    expect(checkUnknown.isStrictlyImmutable).toBe(false);
  });
});
