/**
 * @file sovereign-quinquagintaquadrillion-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Sovereign Quinquaginta-Quadrillion Conclave Arbitration (99.99999999999999999% Supermajority, 99.9999999999% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateSovereignQuinquagintaquadrillionConclaveDispute,
  verifyQuinquagintaquadrillionEmpireConstitutionalInvariants,
} from '../sovereign-quinquagintaquadrillion-conclave-engine';
import type { SovereignQuinquagintaquadrillionJurorVote } from '@/seed/types/quinquagintaquadrillion-braided-stark-conclave';

describe('Sovereign Quinquaginta-Quadrillion Conclave & Constitutional Invariants Engine', () => {
  it('delivers Claimant verdict and slashes dissenting rogue jurors by 99.9999999999%', () => {
    const votes: SovereignQuinquagintaquadrillionJurorVote[] = [];
    for (let i = 0; i < 999; i++) {
      votes.push({ jurorId: `HONEST_${i}`, voteForClaimant: true, stakeCents: 2000_000_00 });
    }
    votes.push({ jurorId: 'ROGUE_1', voteForClaimant: false, stakeCents: 2000_000_00 });

    const result = arbitrateSovereignQuinquagintaquadrillionConclaveDispute({
      disputeCaseRef: 'DISPUTE_QUINQUAGINTA_001',
      claimantParticipantId: 'CLAIMANT_QUINQUAGINTA_CORP',
      respondentParticipantId: 'RESPONDENT_DEFENDANT',
      disputeValueCents: 100_000_000_00,
      evidenceSha256: 'b'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.0, // test threshold
    });

    expect(result.verdict).toBe('CLAIMANT_PREVAILS');
    expect(result.claimantVotes).toBe(999);
    expect(result.respondentVotes).toBe(1);
    expect(result.jurorsSlashedCount).toBe(1);
    expect(result.totalSlashedStakeCents).toBe(Math.floor(2000_000_00 * 0.9999999999));
    expect(result.executedRemedyCents).toBe(100_000_000_00);
    expect(result.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects attempt to alter strictly immutable constitutional invariant', () => {
    const check = verifyQuinquagintaquadrillionEmpireConstitutionalInvariants('ART_01_COGNITIVE_AUTONOMY');
    expect(check.allowed).toBe(false);
    expect(check.isStrictlyImmutable).toBe(true);
    expect(check.reason).toContain('Strictly Immutable');
  });

  it('permits unknown or non-immutable article queries', () => {
    const check = verifyQuinquagintaquadrillionEmpireConstitutionalInvariants('ART_99_OPTIONAL_EXTENSION');
    expect(check.allowed).toBe(true);
    expect(check.isStrictlyImmutable).toBe(false);
  });
});
