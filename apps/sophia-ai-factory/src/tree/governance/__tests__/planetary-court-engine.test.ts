/**
 * @file planetary-court-engine.test.ts
 * @description Unit tests for Planetary Constitutional Court arbitration and invariant verification.
 */

import { describe, expect, it } from 'vitest';
import {
  arbitratePlanetaryDispute,
  verifyConstitutionalInvariants,
} from '../planetary-court-engine';
import type {
  ConstitutionalInvariant,
  JurorVote,
} from '@/seed/types/post-quantum-constitution';

describe('Planetary Constitutional Court Engine', () => {
  it('1. Renders claimant victory when supermajority >= 75% and slashes minority dissenters', () => {
    // 8 out of 9 jurors vote for claimant (88.89% >= 75%)
    const votes: JurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J2', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J3', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J4', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J5', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J6', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J7', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J8', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J9', voteForClaimant: false, stakeCents: 10_000_00 }, // dissenter
    ];

    const verdict = arbitratePlanetaryDispute({
      disputeCaseRef: 'DISPUTE_2026_001',
      claimantParticipantId: 'CORP_ALICE',
      respondentParticipantId: 'CORP_BOB',
      disputeValueCents: 500_000_00,
      evidenceSha256: 'abc123evidencehash',
      votes,
      supermajorityThresholdPct: 75.0,
    });

    expect(verdict.verdict).toBe('CLAIMANT_PREVAILS');
    expect(verdict.effectiveSupermajorityPct).toBe(88.89);
    expect(verdict.executedRemedyCents).toBe(500_000_00);
    expect(verdict.jurorsSlashedCount).toBe(1);
    expect(verdict.totalSlashedStakeCents).toBe(2_500_00); // 25% of 10,000,00
    expect(verdict.rulingHash).toHaveLength(64);
  });

  it('2. Keeps case in deliberating state when neither side achieves 75% supermajority', () => {
    // 5 vs 4 vote (55.56% < 75%)
    const votes: JurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J2', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J3', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J4', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J5', voteForClaimant: true, stakeCents: 10_000_00 },
      { jurorId: 'J6', voteForClaimant: false, stakeCents: 10_000_00 },
      { jurorId: 'J7', voteForClaimant: false, stakeCents: 10_000_00 },
      { jurorId: 'J8', voteForClaimant: false, stakeCents: 10_000_00 },
      { jurorId: 'J9', voteForClaimant: false, stakeCents: 10_000_00 },
    ];

    const verdict = arbitratePlanetaryDispute({
      disputeCaseRef: 'DISPUTE_2026_002',
      claimantParticipantId: 'CORP_ALICE',
      respondentParticipantId: 'CORP_BOB',
      disputeValueCents: 500_000_00,
      evidenceSha256: 'abc123evidencehash',
      votes,
    });

    expect(verdict.verdict).toBe('DELIBERATING');
    expect(verdict.jurorsSlashedCount).toBe(0);
    expect(verdict.executedRemedyCents).toBe(0);
  });

  it('3. Strictly rejects mutation of immutable constitutional articles', () => {
    const registry: ConstitutionalInvariant[] = [
      {
        id: '1',
        articleCode: 'ART_01_HUMAN_SOVEREIGNTY',
        articleTitle: 'Fundamental Human Inalienable Sovereignty',
        isStrictlyImmutable: true,
        enforcementCircuitHash: 'hash1',
        lastTheoremVerifiedAt: '2026-09-27T00:00:00Z',
        createdAt: '2026-09-27T00:00:00Z',
      },
      {
        id: '2',
        articleCode: 'ART_02_FULL_RESERVE_BACKING',
        articleTitle: 'Mandatory 100% Reserve Solvency Ratio',
        isStrictlyImmutable: true,
        enforcementCircuitHash: 'hash2',
        lastTheoremVerifiedAt: '2026-09-27T00:00:00Z',
        createdAt: '2026-09-27T00:00:00Z',
      },
    ];

    const check = verifyConstitutionalInvariants(registry, 'ART_01_HUMAN_SOVEREIGNTY');
    expect(check.allowed).toBe(false);
    expect(check.violationReason).toContain('strictly immutable');
  });

  it('4. Allows non-immutable policy adjustments', () => {
    const registry: ConstitutionalInvariant[] = [
      {
        id: '1',
        articleCode: 'ART_88_API_RATE_LIMITS',
        articleTitle: 'Dynamic API Gateway Rate Limit Scaling',
        isStrictlyImmutable: false,
        enforcementCircuitHash: 'hash88',
        lastTheoremVerifiedAt: '2026-09-27T00:00:00Z',
        createdAt: '2026-09-27T00:00:00Z',
      },
    ];

    const check = verifyConstitutionalInvariants(registry, 'ART_88_API_RATE_LIMITS');
    expect(check.allowed).toBe(true);
    expect(check.violationReason).toBeUndefined();
  });
});
