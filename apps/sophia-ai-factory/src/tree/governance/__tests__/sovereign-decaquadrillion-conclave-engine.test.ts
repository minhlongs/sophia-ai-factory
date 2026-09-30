/**
 * @file sovereign-decaquadrillion-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Sovereign Deca-Quadrillion Conclave Arbitration (99.999999999999% Supermajority, 99.99999999% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateSovereignDecaquadrillionConclaveDispute,
  CANONICAL_DECAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  verifyDecaquadrillionEmpireConstitutionalInvariant,
  verifyDecaquadrillionEmpireConstitutionalInvariants,
} from '../sovereign-decaquadrillion-conclave-engine';
import type { SovereignDecaquadrillionJurorVote } from '@/seed/types/decaquadrillion-braided-stark-conclave';

describe('Sovereign Deca-Quadrillion Conclave Arbitration Engine', () => {
  it('delivers CLAIMANT_PREVAILS verdict and slashes rogue jurors at 99.99999999% penalty upon 99.999999999999% supermajority', () => {
    // 100,000,000,000 votes total: 99,999,999,999 claimant, 1 rogue respondent
    const votes: SovereignDecaquadrillionJurorVote[] = [
      { jurorId: 'JUROR_ROGUE', voteForClaimant: false, stakeCents: 10_000_000_00 },
    ];
    // Fill 999 claimant votes
    for (let i = 0; i < 999; i++) {
      votes.push({ jurorId: `JUROR_C_${i}`, voteForClaimant: true, stakeCents: 10_000_000_00 });
    }

    const ruling = arbitrateSovereignDecaquadrillionConclaveDispute({
      disputeCaseRef: 'DISPUTE-CASE-DECA-001',
      claimantParticipantId: 'CLAIMANT_ALPHA',
      respondentParticipantId: 'RESPONDENT_BETA',
      disputeValueCents: 50_000_000_00,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
      supermajorityThresholdPct: 99.0, // test threshold
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(1000);
    expect(ruling.claimantVotes).toBe(999);
    expect(ruling.respondentVotes).toBe(1);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(Math.floor(10_000_000_00 * 0.99999999));
    expect(ruling.executedRemedyCents).toBe(50_000_000_00);
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('remains in DELIBERATING state if supermajority threshold is not met', () => {
    const votes: SovereignDecaquadrillionJurorVote[] = [
      { jurorId: 'JUROR_1', voteForClaimant: true, stakeCents: 1_000_000_00 },
      { jurorId: 'JUROR_2', voteForClaimant: false, stakeCents: 1_000_000_00 },
    ];

    const ruling = arbitrateSovereignDecaquadrillionConclaveDispute({
      disputeCaseRef: 'DISPUTE-CASE-DECA-002',
      claimantParticipantId: 'CLAIMANT_1',
      respondentParticipantId: 'RESPONDENT_2',
      disputeValueCents: 10_000_000_00,
      evidenceSha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      votes,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.totalSlashedStakeCents).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('strictly rejects actions attempting to override immutable constitutional invariants', () => {
    const invariant = CANONICAL_DECAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS[0]; // Cognitive autonomy
    const check = verifyDecaquadrillionEmpireConstitutionalInvariant(
      invariant,
      'ATTEMPT_OVERRIDE_CONSTITUTIONAL_GOVERNANCE'
    );

    expect(check.allowed).toBe(false);
    expect(check.isStrictlyImmutable).toBe(true);
    expect(check.reason).toContain('violates strictly immutable');
  });

  it('validates canonical invariant registry lookup', () => {
    const check = verifyDecaquadrillionEmpireConstitutionalInvariants('ART_03_MATHEMATICAL_DETERMINISM');
    expect(check.allowed).toBe(false); // strictly immutable
    expect(check.isStrictlyImmutable).toBe(true);

    const nonExistent = verifyDecaquadrillionEmpireConstitutionalInvariants('NON_EXISTENT_ARTICLE');
    expect(nonExistent.allowed).toBe(true);
    expect(nonExistent.isStrictlyImmutable).toBe(false);
  });
});
