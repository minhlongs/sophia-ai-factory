/**
 * @file sovereign-vigintiquinquemilliaquadrillion-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Sovereign Viginti-Quinque-Millia-Quadrillion Conclave Arbitration and Constitutional Invariant Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateSovereignVigintiquinquemilliaquadrillionConclaveDispute,
  verifyVigintiquinquemilliaquadrillionEmpireConstitutionalInvariant,
  CANONICAL_VIGINTIQUINQUEMILLIAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
} from '../sovereign-vigintiquinquemilliaquadrillion-conclave-engine';
import type { SovereignVigintiquinquemilliaquadrillionJurorVote } from '@/seed/types/vigintiquinquemilliaquadrillion-braided-stark-conclave';

describe('Sovereign Viginti-Quinque-Millia-Quadrillion Conclave Arbitration Engine', () => {
  it('rules in favor of claimant and executes remedy when 99.9999999999999999999999999% supermajority is achieved', () => {
    const votes: SovereignVigintiquinquemilliaquadrillionJurorVote[] = Array.from({ length: 100_000 }, (_, i) => ({
      jurorId: `juror-${i}`,
      voteForClaimant: true,
      stakeCents: 10_000_000,
    }));

    const ruling = arbitrateSovereignVigintiquinquemilliaquadrillionConclaveDispute({
      disputeCaseRef: 'CASE-VIGINTI-001',
      claimantParticipantId: 'claimant-agent-01',
      respondentParticipantId: 'respondent-agent-02',
      disputeValueCents: 5_000_000_000_000,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.claimantVotes).toBe(100_000);
    expect(ruling.respondentVotes).toBe(0);
    expect(ruling.executedRemedyCents).toBe(5_000_000_000_000);
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('deliberates when threshold is not reached and slashes no jurors', () => {
    const votes: SovereignVigintiquinquemilliaquadrillionJurorVote[] = [
      { jurorId: 'j-1', voteForClaimant: true, stakeCents: 5_000_000 },
      { jurorId: 'j-2', voteForClaimant: false, stakeCents: 5_000_000 },
    ];

    const ruling = arbitrateSovereignVigintiquinquemilliaquadrillionConclaveDispute({
      disputeCaseRef: 'CASE-VIGINTI-002',
      claimantParticipantId: 'claimant-agent-01',
      respondentParticipantId: 'respondent-agent-02',
      disputeValueCents: 10_000_000,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.executedRemedyCents).toBe(0);
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.totalSlashedStakeCents).toBe(0);
  });

  it('enforces Viginti-Quinque-Millia-Quadrillion constitutional invariants against overrides', () => {
    const invariant = CANONICAL_VIGINTIQUINQUEMILLIAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS[0];
    const breachCheck = verifyVigintiquinquemilliaquadrillionEmpireConstitutionalInvariant(
      invariant,
      'OVERRIDE_CONSTITUTIONAL_AUTONOMY'
    );
    expect(breachCheck.allowed).toBe(false);
    expect(breachCheck.reason).toContain('violates strictly immutable');

    const validCheck = verifyVigintiquinquemilliaquadrillionEmpireConstitutionalInvariant(
      invariant,
      'OPTIMIZE_AGENTIC_EXECUTION'
    );
    expect(validCheck.allowed).toBe(true);
  });
});
