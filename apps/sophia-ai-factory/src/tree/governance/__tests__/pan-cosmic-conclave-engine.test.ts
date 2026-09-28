/**
 * @file pan-cosmic-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Pan-Cosmic Constitutional Conclave Arbitration Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  arbitratePanCosmicDispute,
  verifyPanCosmicConstitutionalInvariants,
} from '../pan-cosmic-conclave-engine';
import type {
  PanCosmicConstitutionalInvariant,
  PanCosmicJurorVote,
} from '@/seed/types/topological-braided-conclave';

describe('Pan-Cosmic Conclave Engine', () => {
  it('delivers CLAIMANT_PREVAILS when claimant achieves ≥98.0% supermajority', () => {
    // 98 honest jurors for claimant, 2 dissenting jurors
    const votes: PanCosmicJurorVote[] = [
      ...Array.from({ length: 98 }, (_, i) => ({
        jurorId: `JUROR_HONEST_${i}`,
        voteForClaimant: true,
        stakeCents: 100_000_00,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        jurorId: `JUROR_DISSENT_${i}`,
        voteForClaimant: false,
        stakeCents: 100_000_00,
      })),
    ];

    const ruling = arbitratePanCosmicDispute({
      disputeCaseRef: 'DISPUTE_PAN_COSMIC_001',
      claimantParticipantId: 'CLAIMANT_CORP',
      respondentParticipantId: 'RESPONDENT_LLC',
      disputeValueCents: 50_000_000_00,
      evidenceSha256: 'a'.repeat(64),
      votes,
      supermajorityThresholdPct: 98.0,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.effectiveSupermajorityPct).toBe(98.0);
    expect(ruling.executedRemedyCents).toBe(50_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(2);
    expect(ruling.totalSlashedStakeCents).toBe(2 * 60_000_00); // 60% of 100,000.00
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('delivers DELIBERATING when neither side reaches 98.0% supermajority', () => {
    const votes: PanCosmicJurorVote[] = [
      ...Array.from({ length: 90 }, (_, i) => ({
        jurorId: `JUROR_CLAIM_${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_00,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        jurorId: `JUROR_RESP_${i}`,
        voteForClaimant: false,
        stakeCents: 10_000_00,
      })),
    ];

    const ruling = arbitratePanCosmicDispute({
      disputeCaseRef: 'DISPUTE_DELIBERATING_002',
      claimantParticipantId: 'CLAIMANT_1',
      respondentParticipantId: 'RESPONDENT_1',
      disputeValueCents: 10_000_000_00,
      evidenceSha256: 'b'.repeat(64),
      votes,
      supermajorityThresholdPct: 98.0,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('blocks modification of strictly immutable constitutional invariants', () => {
    const invariants: PanCosmicConstitutionalInvariant[] = [
      {
        articleCode: 'ART_COSMIC_INVARIANT_01',
        articleTitle: 'Universal Non-Custodial Invariance & Sovereign Autonomy',
        isStrictlyImmutable: true,
        enforcementCircuitHash: 'circuit_pan_cosmic_01',
        lastTheoremVerifiedAt: '2026-09-28T00:00:00Z',
      },
    ];

    const result = verifyPanCosmicConstitutionalInvariants(
      invariants,
      'ART_COSMIC_INVARIANT_01'
    );

    expect(result.allowed).toBe(false);
    expect(result.isStrictlyImmutable).toBe(true);
    expect(result.reason).toContain('Strictly Immutable');
  });
});
