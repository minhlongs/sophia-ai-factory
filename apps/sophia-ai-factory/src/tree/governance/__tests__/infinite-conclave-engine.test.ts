/**
 * @file infinite-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Infinite Conclave Council Arbitration (99.5% Supermajority, 80% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateInfiniteConclaveDispute,
  verifyInfiniteConstitutionalInvariants,
} from '../infinite-conclave-engine';
import type {
  InfiniteConstitutionalInvariant,
  InfiniteJurorVote,
} from '@/seed/types/non-archimedean-stark-conclave';

describe('Infinite Conclave Council Governance Engine', () => {
  it('rules for claimant when 99.5% supermajority threshold is reached and slashes rogue minority at 80%', () => {
    // 200 jurors: 199 vote for claimant, 1 rogue votes against (199 / 200 = 99.5%)
    const votes: InfiniteJurorVote[] = [
      ...Array.from({ length: 199 }, (_, i) => ({
        jurorId: `JUROR_HONEST_${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_000_00, // $100,000 stake
      })),
      {
        jurorId: 'JUROR_ROGUE_0',
        voteForClaimant: false,
        stakeCents: 10_000_000_00, // $100,000 stake -> $80,000 slashed
      },
    ];

    const ruling = arbitrateInfiniteConclaveDispute({
      disputeCaseRef: 'DISPUTE-MULTI-001',
      claimantParticipantId: 'MULTIVERSE_CORP',
      respondentParticipantId: 'ROGUE_SYNDICATE',
      disputeValueCents: 100_000_000_00, // $1,000,000.00
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
      supermajorityThresholdPct: 99.5,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.effectiveSupermajorityPct).toBe(99.5);
    expect(ruling.executedRemedyCents).toBe(100_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(8_000_000_00); // 80% of $100,000
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('deliberates when supermajority threshold of 99.5% is not met', () => {
    // 100 jurors: 98 vote for claimant, 2 vote for respondent (98% < 99.5%)
    const votes: InfiniteJurorVote[] = [
      ...Array.from({ length: 98 }, (_, i) => ({
        jurorId: `JUROR_A_${i}`,
        voteForClaimant: true,
        stakeCents: 1000_00,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        jurorId: `JUROR_B_${i}`,
        voteForClaimant: false,
        stakeCents: 1000_00,
      })),
    ];

    const ruling = arbitrateInfiniteConclaveDispute({
      disputeCaseRef: 'DISPUTE-MULTI-002',
      claimantParticipantId: 'PARTY_ALPHA',
      respondentParticipantId: 'PARTY_BETA',
      disputeValueCents: 20_000_00,
      evidenceSha256: 'abc123456',
      votes,
      supermajorityThresholdPct: 99.5,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('protects strictly immutable constitutional invariants and denies alteration', () => {
    const invariants: InfiniteConstitutionalInvariant[] = [
      {
        articleCode: 'ART-001-IRREVOCABLE-FINALITY',
        articleTitle: 'Sub-1ns Quantum Settlement Irrevocability',
        isStrictlyImmutable: true,
        enforcementCircuitHash: 'circuit_hash_001',
        lastTheoremVerifiedAt: '2026-09-28T00:00:00Z',
      },
      {
        articleCode: 'ART-005-MUTABLE-PARAMS',
        articleTitle: 'Dynamic Resource Quotas',
        isStrictlyImmutable: false,
        enforcementCircuitHash: 'circuit_hash_005',
        lastTheoremVerifiedAt: '2026-09-28T00:00:00Z',
      },
    ];

    const check1 = verifyInfiniteConstitutionalInvariants(invariants, 'ART-001-IRREVOCABLE-FINALITY');
    expect(check1.allowed).toBe(false);
    expect(check1.isStrictlyImmutable).toBe(true);
    expect(check1.reason).toContain('Strictly Immutable');

    const check2 = verifyInfiniteConstitutionalInvariants(invariants, 'ART-005-MUTABLE-PARAMS');
    expect(check2.allowed).toBe(true);
    expect(check2.isStrictlyImmutable).toBe(false);
  });
});
