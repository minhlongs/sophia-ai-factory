/**
 * @file sovereign-quinquagintiquadrillion-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Sovereign Quinquaginti-Quadrillion Conclave Arbitration Engine & Constitutional Invariants.
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateSovereignQuinquagintiquadrillionConclaveDispute,
  verifyQuinquagintiquadrillionEmpireConstitutionalInvariant,
  verifyQuinquagintiquadrillionEmpireConstitutionalInvariants,
  CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from '../sovereign-quinquagintiquadrillion-conclave-engine';
import type { SovereignQuinquagintiquadrillionJurorVote } from '@/seed/types/quinquagintiquadrillion-braided-stark-conclave';

describe('Sovereign Quinquaginti-Quadrillion Conclave Engine', () => {
  it('delivers CLAIMANT_PREVAILS when supermajority exceeds 99.99999999999999% and slashes dissenting jurors', () => {
    const votes: SovereignQuinquagintiquadrillionJurorVote[] = [];
    for (let i = 0; i < 9999; i++) {
      votes.push({ jurorId: `HONEST_${i}`, voteForClaimant: true, stakeCents: 100_000_000_00 });
    }
    votes.push({ jurorId: 'ROGUE_ONE', voteForClaimant: false, stakeCents: 100_000_000_00 });

    const ruling = arbitrateSovereignQuinquagintiquadrillionConclaveDispute({
      disputeCaseRef: 'CASE-QUINQUAGINTI-001',
      claimantParticipantId: 'CLAIMANT_1',
      respondentParticipantId: 'RESPONDENT_1',
      disputeValueCents: 500_000_000_00,
      evidenceSha256: 'a'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.9, // test threshold
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(10000);
    expect(ruling.claimantVotes).toBe(9999);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(Math.floor(100_000_000_00 * 0.999999999));
    expect(ruling.executedRemedyCents).toBe(500_000_000_00);
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('remains DELIBERATING when no party achieves supermajority consensus', () => {
    const votes: SovereignQuinquagintiquadrillionJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 1000_00 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 1000_00 },
    ];

    const ruling = arbitrateSovereignQuinquagintiquadrillionConclaveDispute({
      disputeCaseRef: 'CASE-QUINQUAGINTI-002',
      claimantParticipantId: 'CLAIMANT_2',
      respondentParticipantId: 'RESPONDENT_2',
      disputeValueCents: 1000_00,
      evidenceSha256: 'b'.repeat(64),
      votes,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('rejects constitutional override attempts against strictly immutable charter articles', () => {
    const invariant = CANONICAL_QUINQUAGINTIQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS[0];
    const check = verifyQuinquagintiquadrillionEmpireConstitutionalInvariant(
      invariant,
      'OVERRIDE_CONSTITUTIONAL_CORE_PROTECTIONS'
    );

    expect(check.allowed).toBe(false);
    expect(check.isStrictlyImmutable).toBe(true);
    expect(check.reason).toContain('violates strictly immutable');

    const checkAll = verifyQuinquagintiquadrillionEmpireConstitutionalInvariants('ART_01_COGNITIVE_AUTONOMY');
    expect(checkAll.allowed).toBe(false);
    expect(checkAll.isStrictlyImmutable).toBe(true);
  });
});
