/**
 * @file omnipresent-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Omnipresent Supreme Conclave Arbitration (99.95% Supermajority, 95% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitrateOmnipresentConclaveDispute,
  verifyOmnipresentConstitutionalInvariant,
  verifyOmnipresentConstitutionalInvariants,
} from '../omnipresent-conclave-engine';
import type {
  OmnipresentConstitutionalInvariant,
  OmnipresentJurorVote,
} from '@/seed/types/braided-stark-conclave';

describe('Omnipresent Supreme Conclave Engine', () => {
  it('delivers CLAIMANT_PREVAILS and slashes 95% of dissenting jurors when 99.95% supermajority is achieved', () => {
    // 2000 jurors: 1999 for claimant, 1 for respondent -> 99.95%
    const votes: OmnipresentJurorVote[] = [];
    for (let i = 0; i < 1999; i++) {
      votes.push({ jurorId: `JUROR_YES_${i}`, voteForClaimant: true, stakeCents: 100_000_00 });
    }
    votes.push({ jurorId: 'JUROR_ROGUE_1', voteForClaimant: false, stakeCents: 100_000_00 });

    const ruling = arbitrateOmnipresentConclaveDispute({
      disputeCaseRef: 'DISPUTE_OMNIPRESENT_001',
      claimantParticipantId: 'MULTIVERSE_CORP',
      respondentParticipantId: 'SHADOW_DAO',
      disputeValueCents: 50_000_000_00,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
      supermajorityThresholdPct: 99.95,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.effectiveSupermajorityPct).toBe(99.95);
    expect(ruling.executedRemedyCents).toBe(50_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(95_000_00); // 95% of $100,000 = $95,000
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps verdict in DELIBERATING when threshold of 99.95% is not reached', () => {
    // 1000 jurors: 990 for claimant (99.0%), 10 for respondent (1.0%)
    const votes: OmnipresentJurorVote[] = [];
    for (let i = 0; i < 990; i++) {
      votes.push({ jurorId: `JUROR_YES_${i}`, voteForClaimant: true, stakeCents: 100_000_00 });
    }
    for (let i = 0; i < 10; i++) {
      votes.push({ jurorId: `JUROR_NO_${i}`, voteForClaimant: false, stakeCents: 100_000_00 });
    }

    const ruling = arbitrateOmnipresentConclaveDispute({
      disputeCaseRef: 'DISPUTE_OMNIPRESENT_002',
      claimantParticipantId: 'A',
      respondentParticipantId: 'B',
      disputeValueCents: 10_000_000_00,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
      supermajorityThresholdPct: 99.95,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('strictly protects immutable Omnipresent constitutional invariants', () => {
    const invariant: OmnipresentConstitutionalInvariant = {
      articleCode: 'ART-001-IRREVOCABLE-FINALITY',
      articleTitle: 'Sub-200ps Quantum Settlement Irrevocability',
      isStrictlyImmutable: true,
      enforcementCircuitHash: 'hash123',
      lastTheoremVerifiedAt: new Date().toISOString(),
    };

    const breachAttempt = verifyOmnipresentConstitutionalInvariant(
      invariant,
      'OVERRIDE_CONSTITUTIONAL_FINALITY_ROLLBACK'
    );

    expect(breachAttempt.allowed).toBe(false);
    expect(breachAttempt.reason).toContain('strictly immutable');

    const permittedAction = verifyOmnipresentConstitutionalInvariant(
      invariant,
      'AUDIT_AND_CONFIRM_FINALITY'
    );

    expect(permittedAction.allowed).toBe(true);

    const checkArray = verifyOmnipresentConstitutionalInvariants([invariant], 'ART-001-IRREVOCABLE-FINALITY');
    expect(checkArray.allowed).toBe(false);
    expect(checkArray.isStrictlyImmutable).toBe(true);
  });
});
