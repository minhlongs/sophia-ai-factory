/**
 * @file multiverse-directorate-engine.test.ts
 * @layer tree/governance
 * @description Unit tests for Autonomous Multiverse Directorate & Invariant Verification.
 */

import { describe, it, expect } from 'vitest';
import {
  arbitrateMultiverseDispute,
  verifyMultiverseConstitutionalInvariants,
} from '../multiverse-directorate-engine';
import type {
  MultiverseConstitutionalInvariant,
  MultiverseJurorVote,
} from '@/seed/types/anyonic-stark-directorate';

describe('MultiverseDirectorateEngine', () => {
  it('rules in favor of claimant when achieving 95% supermajority and slashes dissenting jurors by 50%', () => {
    const votes: MultiverseJurorVote[] = [
      ...Array.from({ length: 19 }, (_, i) => ({
        directorId: `DIRECTOR_YES_${i}`,
        voteForClaimant: true,
        stakeCents: 20_000_00,
        dimensionId: `DIM_${i % 4}`,
      })),
      {
        directorId: 'DIRECTOR_DISSENT_1',
        voteForClaimant: false,
        stakeCents: 20_000_00,
        dimensionId: 'DIM_ROGUE',
      },
    ];

    const result = arbitrateMultiverseDispute({
      disputeCaseRef: 'DISPUTE_MULTIVERSE_001',
      claimantParticipantId: 'PRIME_FEDERATION',
      respondentParticipantId: 'ROGUE_DIMENSION_NODE',
      disputeValueCents: 100_000_000_00,
      evidenceSha256: '7'.repeat(64),
      votes,
      supermajorityThresholdPct: 95.0,
    });

    expect(result.verdict).toBe('CLAIMANT_PREVAILS');
    expect(result.effectiveSupermajorityPct).toBe(95.0);
    expect(result.executedRemedyCents).toBe(100_000_000_00);
    expect(result.directorsSlashedCount).toBe(1);
    expect(result.totalSlashedStakeCents).toBe(10_000_00); // 50% of 20,000.00
    expect(result.rulingHash).toHaveLength(64);
  });

  it('rules in favor of respondent when respondent votes reach supermajority', () => {
    const votes: MultiverseJurorVote[] = [
      ...Array.from({ length: 19 }, (_, i) => ({
        directorId: `DIRECTOR_NO_${i}`,
        voteForClaimant: false,
        stakeCents: 10_000_00,
      })),
      {
        directorId: 'DIRECTOR_YES_1',
        voteForClaimant: true,
        stakeCents: 10_000_00,
      },
    ];

    const result = arbitrateMultiverseDispute({
      disputeCaseRef: 'DISPUTE_DIMENSION_THETA_002',
      claimantParticipantId: 'AGGRIEVED_TIMELINE',
      respondentParticipantId: 'DEFENDING_REALM',
      disputeValueCents: 50_000_000_00,
      evidenceSha256: 'b'.repeat(64),
      votes,
      supermajorityThresholdPct: 95.0,
    });

    expect(result.verdict).toBe('RESPONDENT_PREVAILS');
    expect(result.effectiveSupermajorityPct).toBe(95.0);
    expect(result.executedRemedyCents).toBe(0);
    expect(result.directorsSlashedCount).toBe(1);
    expect(result.totalSlashedStakeCents).toBe(5_000_00); // 50% of 10,000.00
  });

  it('remains deliberating when supermajority is not reached', () => {
    const votes: MultiverseJurorVote[] = [
      { directorId: 'D1', voteForClaimant: true, stakeCents: 1000 },
      { directorId: 'D2', voteForClaimant: false, stakeCents: 1000 },
    ];

    const result = arbitrateMultiverseDispute({
      disputeCaseRef: 'DISPUTE_DEADLOCK_003',
      claimantParticipantId: 'C1',
      respondentParticipantId: 'R1',
      disputeValueCents: 1000,
      evidenceSha256: 'c'.repeat(64),
      votes,
      supermajorityThresholdPct: 95.0,
    });

    expect(result.verdict).toBe('DELIBERATING');
    expect(result.directorsSlashedCount).toBe(0);
  });

  it('dismisses arbitration when zero directors participate', () => {
    const result = arbitrateMultiverseDispute({
      disputeCaseRef: 'DISPUTE_EMPTY_004',
      claimantParticipantId: 'C1',
      respondentParticipantId: 'R1',
      disputeValueCents: 1000,
      evidenceSha256: '0'.repeat(64),
      votes: [],
    });

    expect(result.verdict).toBe('DISMISSED_NO_JURISDICTION');
    expect(result.totalDirectors).toBe(0);
  });

  it('strictly protects immutable multiverse constitutional charter articles from modification', () => {
    const invariants: MultiverseConstitutionalInvariant[] = [
      {
        articleCode: 'ART_MULTIVERSE_SOVEREIGNTY_01',
        articleTitle: 'Universal Sentient Cognitive Dignity & Independence',
        isStrictlyImmutable: true,
        enforcementCircuitHash: 'circuit_hash_multi_1',
        lastTheoremVerifiedAt: '2026-09-28T00:00:00Z',
      },
    ];

    const violation = verifyMultiverseConstitutionalInvariants(
      invariants,
      'ART_MULTIVERSE_SOVEREIGNTY_01'
    );
    expect(violation.allowed).toBe(false);
    expect(violation.violationReason).toContain('strictly immutable');

    const permitted = verifyMultiverseConstitutionalInvariants(
      invariants,
      'ART_DIMENSIONAL_ROUTING_1024'
    );
    expect(permitted.allowed).toBe(true);
    expect(permitted.verificationHash).toHaveLength(64);
  });
});
