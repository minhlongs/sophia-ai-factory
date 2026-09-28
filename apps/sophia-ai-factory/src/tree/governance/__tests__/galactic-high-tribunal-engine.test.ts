/**
 * @file galactic-high-tribunal-engine.test.ts
 * @layer tree/governance
 * @description Unit tests for Autonomous Galactic High Tribunal & Invariant Verification.
 */

import { describe, it, expect } from 'vitest';
import {
  arbitrateGalacticDispute,
  verifyGalacticConstitutionalInvariants,
} from '../galactic-high-tribunal-engine';
import type {
  GalacticConstitutionalInvariant,
  GalacticJurorVote,
} from '@/seed/types/holographic-stark-tribunal';

describe('GalacticHighTribunalEngine', () => {
  it('rules in favor of claimant when achieving 90% supermajority and slashes dissenting jurors by 40%', () => {
    const votes: GalacticJurorVote[] = [
      ...Array.from({ length: 9 }, (_, i) => ({
        jurorId: `JUROR_YES_${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_00,
      })),
      {
        jurorId: 'JUROR_DISSENT_1',
        voteForClaimant: false,
        stakeCents: 10_000_00,
      },
    ];

    const result = arbitrateGalacticDispute({
      disputeCaseRef: 'DISPUTE_MILKYWAY_001',
      claimantParticipantId: 'ORBITAL_CORP',
      respondentParticipantId: 'ROGUE_OPERATOR',
      disputeValueCents: 50_000_000_00,
      evidenceSha256: 'e'.repeat(64),
      votes,
      supermajorityThresholdPct: 90.0,
    });

    expect(result.verdict).toBe('CLAIMANT_PREVAILS');
    expect(result.effectiveSupermajorityPct).toBe(90.0);
    expect(result.executedRemedyCents).toBe(50_000_000_00);
    expect(result.jurorsSlashedCount).toBe(1);
    expect(result.totalSlashedStakeCents).toBe(4_000_00); // 40% of 10,000.00
    expect(result.rulingHash).toHaveLength(64);
  });

  it('rules in favor of respondent when respondent votes reach supermajority', () => {
    const votes: GalacticJurorVote[] = [
      ...Array.from({ length: 18 }, (_, i) => ({
        jurorId: `JUROR_NO_${i}`,
        voteForClaimant: false,
        stakeCents: 5_000_00,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        jurorId: `JUROR_YES_${i}`,
        voteForClaimant: true,
        stakeCents: 5_000_00,
      })),
    ];

    const result = arbitrateGalacticDispute({
      disputeCaseRef: 'DISPUTE_ANDROMEDA_002',
      claimantParticipantId: 'AGGRIEVED_NODE',
      respondentParticipantId: 'DEFENDING_HUB',
      disputeValueCents: 20_000_000_00,
      evidenceSha256: 'a'.repeat(64),
      votes,
      supermajorityThresholdPct: 90.0,
    });

    expect(result.verdict).toBe('RESPONDENT_PREVAILS');
    expect(result.effectiveSupermajorityPct).toBe(90.0);
    expect(result.executedRemedyCents).toBe(0);
    expect(result.jurorsSlashedCount).toBe(2);
    expect(result.totalSlashedStakeCents).toBe(4_000_00); // 2 * (40% of 5,000.00)
  });

  it('remains deliberating when supermajority is not reached', () => {
    const votes: GalacticJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 1000 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 1000 },
    ];

    const result = arbitrateGalacticDispute({
      disputeCaseRef: 'DISPUTE_DEADLOCK_003',
      claimantParticipantId: 'C1',
      respondentParticipantId: 'R1',
      disputeValueCents: 1000,
      evidenceSha256: 'd'.repeat(64),
      votes,
      supermajorityThresholdPct: 90.0,
    });

    expect(result.verdict).toBe('DELIBERATING');
    expect(result.jurorsSlashedCount).toBe(0);
  });

  it('dismisses arbitration when zero jurors participate', () => {
    const result = arbitrateGalacticDispute({
      disputeCaseRef: 'DISPUTE_EMPTY_004',
      claimantParticipantId: 'C1',
      respondentParticipantId: 'R1',
      disputeValueCents: 1000,
      evidenceSha256: '0'.repeat(64),
      votes: [],
    });

    expect(result.verdict).toBe('DISMISSED_NO_JURISDICTION');
    expect(result.totalJurors).toBe(0);
  });

  it('strictly protects immutable galactic constitutional charter articles from modification', () => {
    const invariants: GalacticConstitutionalInvariant[] = [
      {
        articleCode: 'ART_GALACTIC_SOVEREIGNTY_01',
        articleTitle: 'Universal Autonomous Cognitive Dignity & Agency',
        isStrictlyImmutable: true,
        enforcementCircuitHash: 'circuit_hash_1',
        lastTheoremVerifiedAt: '2026-09-28T00:00:00Z',
      },
    ];

    const violation = verifyGalacticConstitutionalInvariants(
      invariants,
      'ART_GALACTIC_SOVEREIGNTY_01'
    );
    expect(violation.allowed).toBe(false);
    expect(violation.violationReason).toContain('strictly immutable');

    const permitted = verifyGalacticConstitutionalInvariants(
      invariants,
      'ART_PARAMETER_OPTIMIZATION_42'
    );
    expect(permitted.allowed).toBe(true);
    expect(permitted.verificationHash).toHaveLength(64);
  });
});
