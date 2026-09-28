/**
 * @file transcendental-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Transcendental Supreme Conclave Arbitration (99.99% Supermajority, 99% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateTranscendentalConclaveDispute,
  verifyTranscendentalConstitutionalInvariant,
  verifyTranscendentalConstitutionalInvariants,
} from '../transcendental-conclave-engine';
import type {
  TranscendentalConstitutionalInvariant,
  TranscendentalJurorVote,
} from '@/seed/types/trans-cosmic-stark-conclave';

describe('Transcendental Supreme Conclave Governance & Arbitration Engine', () => {
  it('delivers CLAIMANT_PREVAILS ruling when 99.99% supermajority threshold is achieved and slashes rogue minority by 99%', () => {
    // 10,000 jurors: 9,999 vote claimant, 1 rogue votes respondent
    const votes: TranscendentalJurorVote[] = [];
    for (let i = 0; i < 9999; i++) {
      votes.push({
        jurorId: `JUROR_SOVEREIGN_${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_00, // $100.00
      });
    }
    votes.push({
      jurorId: 'ROGUE_JUROR_001',
      voteForClaimant: false,
      stakeCents: 1_000_000_00, // $10,000.00
    });

    const ruling = arbitrateTranscendentalConclaveDispute({
      disputeCaseRef: 'DISPUTE_CROSS_OMNIVERSE_001',
      claimantParticipantId: 'MULTIVERSE_ENTITY_A',
      respondentParticipantId: 'MULTIVERSE_ENTITY_B',
      disputeValueCents: 50_000_000_00, // $500,000.00
      evidenceSha256: 'e'.repeat(64),
      votes,
      supermajorityThresholdPct: 99.99,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.totalJurors).toBe(10000);
    expect(ruling.claimantVotes).toBe(9999);
    expect(ruling.respondentVotes).toBe(1);
    expect(ruling.effectiveSupermajorityPct).toBe(99.99);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(990_000_00); // 99% of $10,000 = $9,900
    expect(ruling.executedRemedyCents).toBe(50_000_000_00);
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps dispute in DELIBERATING state if neither side hits 99.99% supermajority', () => {
    const votes: TranscendentalJurorVote[] = [
      { jurorId: 'J1', voteForClaimant: true, stakeCents: 1000_00 },
      { jurorId: 'J2', voteForClaimant: false, stakeCents: 1000_00 },
    ];

    const ruling = arbitrateTranscendentalConclaveDispute({
      disputeCaseRef: 'DISPUTE_HUNG_002',
      claimantParticipantId: 'A',
      respondentParticipantId: 'B',
      disputeValueCents: 10_000_00,
      evidenceSha256: 'a'.repeat(64),
      votes,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.totalSlashedStakeCents).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('handles empty votes gracefully', () => {
    const ruling = arbitrateTranscendentalConclaveDispute({
      disputeCaseRef: 'DISPUTE_EMPTY',
      claimantParticipantId: 'A',
      respondentParticipantId: 'B',
      disputeValueCents: 100_00,
      evidenceSha256: '0'.repeat(64),
      votes: [],
    });

    expect(ruling.verdict).toBe('PENDING_EVIDENCE');
    expect(ruling.totalJurors).toBe(0);
  });

  it('strictly protects immutable constitutional invariants from modification or breach', () => {
    const immutableInvariant: TranscendentalConstitutionalInvariant = {
      articleCode: 'ART_XXV_01',
      articleTitle: 'Universal Non-Archimedean Solvency & Irrevocable Consensus Invariant',
      isStrictlyImmutable: true,
      enforcementCircuitHash: 'f'.repeat(64),
      lastTheoremVerifiedAt: new Date().toISOString(),
    };

    const singleCheckBreach = verifyTranscendentalConstitutionalInvariant(
      immutableInvariant,
      'OVERRIDE_CONSTITUTIONAL_LIMITS'
    );
    expect(singleCheckBreach.allowed).toBe(false);
    expect(singleCheckBreach.reason).toContain('violates strictly immutable Transcendental constitutional article');

    const singleCheckPermitted = verifyTranscendentalConstitutionalInvariant(
      immutableInvariant,
      'AUDIT_COMPLIANCE_PASS'
    );
    expect(singleCheckPermitted.allowed).toBe(true);

    const charter: TranscendentalConstitutionalInvariant[] = [immutableInvariant];
    const batchCheck = verifyTranscendentalConstitutionalInvariants(charter, 'ART_XXV_01');
    expect(batchCheck.allowed).toBe(false);
    expect(batchCheck.isStrictlyImmutable).toBe(true);
    expect(batchCheck.reason).toContain('Strictly Immutable');

    const notFoundCheck = verifyTranscendentalConstitutionalInvariants(charter, 'ART_UNKNOWN');
    expect(notFoundCheck.allowed).toBe(true);
    expect(notFoundCheck.isStrictlyImmutable).toBe(false);
  });
});
