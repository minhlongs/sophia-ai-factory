/**
 * @file sovereign-milliaquadrillion-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Sovereign Millia-Quadrillion Conclave Arbitration & Constitutional Invariant Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateSovereignMilliaquadrillionConclaveDispute,
  CANONICAL_MILLIAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS,
  verifyMilliaquadrillionEmpireConstitutionalInvariant,
} from '../sovereign-milliaquadrillion-conclave-engine';
import type { SovereignMilliaquadrillionJurorVote } from '@/seed/types/milliaquadrillion-braided-stark-conclave';

describe('Sovereign Millia-Quadrillion Conclave & Constitutional Invariant Engine', () => {
  it('rules in favor of claimant when supermajority threshold (99.999999999999999999999%) is achieved and slashes dissenting jurors', () => {
    const totalJurors = 100_000;
    const votes: SovereignMilliaquadrillionJurorVote[] = [];

    for (let i = 0; i < totalJurors; i++) {
      votes.push({
        jurorId: `juror-${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_000,
      });
    }

    const ruling = arbitrateSovereignMilliaquadrillionConclaveDispute({
      disputeCaseRef: 'CASE-MILLIA-001',
      claimantParticipantId: 'claimant-agent-01',
      respondentParticipantId: 'respondent-agent-02',
      disputeValueCents: 500_000_000_000,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.claimantVotes).toBe(100_000);
    expect(ruling.respondentVotes).toBe(0);
    expect(ruling.executedRemedyCents).toBe(500_000_000_000);
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('deliberates when threshold is not reached and slashes no jurors', () => {
    const votes: SovereignMilliaquadrillionJurorVote[] = [
      { jurorId: 'j-1', voteForClaimant: true, stakeCents: 5_000_000 },
      { jurorId: 'j-2', voteForClaimant: false, stakeCents: 5_000_000 },
    ];

    const ruling = arbitrateSovereignMilliaquadrillionConclaveDispute({
      disputeCaseRef: 'CASE-MILLIA-002',
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

  it('enforces Millia-Quadrillion constitutional invariants against overrides', () => {
    const invariant = CANONICAL_MILLIAQUADRILLION_EMPIRE_CONSTITUTIONAL_INVARIANTS[0];
    const breachCheck = verifyMilliaquadrillionEmpireConstitutionalInvariant(
      invariant,
      'OVERRIDE_CONSTITUTIONAL_AUTONOMY'
    );
    expect(breachCheck.allowed).toBe(false);
    expect(breachCheck.reason).toContain('violates strictly immutable');

    const validCheck = verifyMilliaquadrillionEmpireConstitutionalInvariant(
      invariant,
      'OPTIMIZE_AGENTIC_EXECUTION'
    );
    expect(validCheck.allowed).toBe(true);
  });
});
