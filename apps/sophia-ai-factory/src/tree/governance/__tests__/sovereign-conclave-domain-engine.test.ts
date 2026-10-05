/**
 * @file sovereign-conclave-domain-engine.test.ts
 * @layer tree/governance
 * @description Unit tests for canonical Sovereign Conclave Domain Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateParameterizedConclaveDispute,
  verifyParameterizedConstitutionalInvariants,
  type ConclaveJurorVote,
} from '../sovereign-conclave-domain-engine';

describe('SovereignConclaveDomainEngine (Canonical Parameterized Governance Engine)', () => {
  it('arbitrates dispute with supermajority consensus and slashes dissenting jurors', () => {
    const votes: ConclaveJurorVote[] = [
      ...Array.from({ length: 98 }, (_, i) => ({
        jurorId: `JUROR_${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_00,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        jurorId: `ROGUE_${i}`,
        voteForClaimant: false,
        stakeCents: 10_000_00,
      })),
    ];

    const ruling = arbitrateParameterizedConclaveDispute(
      {
        disputeCaseRef: 'CASE_TEST_01',
        claimantParticipantId: 'CLAIMANT_1',
        respondentParticipantId: 'DEFENDANT_1',
        disputeValueCents: 5_000_000,
        evidenceSha256: 'e'.repeat(64),
        votes,
        supermajorityThresholdPct: 98.0,
      },
      {
        slashingPenaltyPct: 60.0,
      }
    );

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.jurorsSlashedCount).toBe(2);
    expect(ruling.totalSlashedStakeCents).toBe(2 * 6_000_00); // 60% of 10,000 = 6,000
    expect(ruling.executedRemedyCents).toBe(5_000_000);
    expect(ruling.rulingHash).toHaveLength(64);
  });

  it('rejects changes to strictly immutable constitutional invariants', () => {
    const invariants = [
      {
        articleCode: 'ART_01',
        articleTitle: 'Immutable Sovereignty',
        isStrictlyImmutable: true,
        enforcementCircuitHash: 'circuit_hash_01',
      },
    ];

    const result = verifyParameterizedConstitutionalInvariants(invariants, 'ART_01');
    expect(result.allowed).toBe(false);
    expect(result.isStrictlyImmutable).toBe(true);
    expect(result.reason).toContain('Strictly Immutable');
  });
});
