/**
 * @file trans-dimensional-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Trans-Dimensional Supreme Conclave Arbitration (99.0% Supermajority, 70% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateTransDimensionalDispute,
  verifyTransDimensionalConstitutionalInvariants,
} from '../trans-dimensional-conclave-engine';
import type {
  TransDimensionalConstitutionalInvariant,
  TransDimensionalJurorVote,
} from '@/seed/types/non-euclidean-stark-conclave';

describe('Trans-Dimensional Supreme Conclave Governance Engine', () => {
  it('rules for claimant when 99.0% supermajority threshold is reached and slashes rogue minority at 70%', () => {
    // 100 jurors: 99 vote for claimant, 1 rogue votes against
    const votes: TransDimensionalJurorVote[] = [
      ...Array.from({ length: 99 }, (_, i) => ({
        jurorId: `JUROR_HONEST_${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_000_00, // $100,000 stake
      })),
      {
        jurorId: 'JUROR_ROGUE_0',
        voteForClaimant: false,
        stakeCents: 10_000_000_00, // $100,000 stake -> $70,000 slashed
      },
    ];

    const ruling = arbitrateTransDimensionalDispute({
      disputeCaseRef: 'DISPUTE-OMEGA-001',
      claimantParticipantId: 'CLAIMANT_CORP',
      respondentParticipantId: 'RESPONDENT_LLC',
      disputeValueCents: 50_000_000_00, // $500,000.00
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
      supermajorityThresholdPct: 99.0,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.effectiveSupermajorityPct).toBe(99.0);
    expect(ruling.executedRemedyCents).toBe(50_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(7_000_000_00); // 70% of $100,000
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('deliberates when supermajority threshold of 99.0% is not met', () => {
    // 100 jurors: 95 vote for claimant, 5 vote for respondent (95% < 99%)
    const votes: TransDimensionalJurorVote[] = [
      ...Array.from({ length: 95 }, (_, i) => ({
        jurorId: `JUROR_A_${i}`,
        voteForClaimant: true,
        stakeCents: 1000_00,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        jurorId: `JUROR_B_${i}`,
        voteForClaimant: false,
        stakeCents: 1000_00,
      })),
    ];

    const ruling = arbitrateTransDimensionalDispute({
      disputeCaseRef: 'DISPUTE-OMEGA-002',
      claimantParticipantId: 'PARTY_A',
      respondentParticipantId: 'PARTY_B',
      disputeValueCents: 10_000_00,
      evidenceSha256: 'abc123',
      votes,
      supermajorityThresholdPct: 99.0,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('protects strictly immutable constitutional invariants and denies alteration', () => {
    const invariants: TransDimensionalConstitutionalInvariant[] = [
      {
        articleCode: 'ART-001-IRREVOCABLE-FINALITY',
        articleTitle: 'Sub-5ns Quantum Settlement Irrevocability',
        isStrictlyImmutable: true,
        enforcementCircuitHash: 'circuit_hash_001',
        lastTheoremVerifiedAt: '2026-09-28T00:00:00Z',
      },
      {
        articleCode: 'ART-004-MUTABLE-FEES',
        articleTitle: 'Dynamic Gas Fee Policy',
        isStrictlyImmutable: false,
        enforcementCircuitHash: 'circuit_hash_004',
        lastTheoremVerifiedAt: '2026-09-28T00:00:00Z',
      },
    ];

    const check1 = verifyTransDimensionalConstitutionalInvariants(invariants, 'ART-001-IRREVOCABLE-FINALITY');
    expect(check1.allowed).toBe(false);
    expect(check1.isStrictlyImmutable).toBe(true);
    expect(check1.reason).toContain('Strictly Immutable');

    const check2 = verifyTransDimensionalConstitutionalInvariants(invariants, 'ART-004-MUTABLE-FEES');
    expect(check2.allowed).toBe(true);
    expect(check2.isStrictlyImmutable).toBe(false);
  });
});
