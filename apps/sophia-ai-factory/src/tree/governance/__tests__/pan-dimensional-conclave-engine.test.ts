/**
 * @file pan-dimensional-conclave-engine.test.ts
 * @layer tree/governance/__tests__
 * @description Unit tests for Pan-Dimensional Supreme Conclave Arbitration (99.9% Supermajority, 90% Slashing).
 */

import { describe, expect, it } from 'vitest';
import {
  arbitratePanDimensionalConclaveDispute,
  verifyPanDimensionalConstitutionalInvariant,
  verifyPanDimensionalConstitutionalInvariants,
} from '../pan-dimensional-conclave-engine';
import type {
  PanDimensionalConstitutionalInvariant,
  PanDimensionalJurorVote,
} from '@/seed/types/topological-stark-conclave';

describe('Pan-Dimensional Supreme Conclave Engine', () => {
  it('delivers CLAIMANT_PREVAILS and slashes 90% of dissenting jurors when 99.9% supermajority is achieved', () => {
    // 1000 jurors: 999 for claimant, 1 for respondent -> 99.9%
    const votes: PanDimensionalJurorVote[] = [];
    for (let i = 0; i < 999; i++) {
      votes.push({ jurorId: `JUROR_YES_${i}`, voteForClaimant: true, stakeCents: 100_000_00 });
    }
    votes.push({ jurorId: 'JUROR_ROGUE_1', voteForClaimant: false, stakeCents: 100_000_00 });

    const ruling = arbitratePanDimensionalConclaveDispute({
      disputeCaseRef: 'DISPUTE_PAN_DIMENSIONAL_001',
      claimantParticipantId: 'MULTIVERSE_CORP',
      respondentParticipantId: 'SHADOW_DAO',
      disputeValueCents: 50_000_000_00,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
      supermajorityThresholdPct: 99.9,
    });

    expect(ruling.verdict).toBe('CLAIMANT_PREVAILS');
    expect(ruling.effectiveSupermajorityPct).toBe(99.9);
    expect(ruling.executedRemedyCents).toBe(50_000_000_00);
    expect(ruling.jurorsSlashedCount).toBe(1);
    expect(ruling.totalSlashedStakeCents).toBe(90_000_00); // 90% of $100,000 = $90,000
    expect(ruling.rulingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps verdict in DELIBERATING when threshold of 99.9% is not reached', () => {
    // 1000 jurors: 990 for claimant (99.0%), 10 for respondent (1.0%)
    const votes: PanDimensionalJurorVote[] = [];
    for (let i = 0; i < 990; i++) {
      votes.push({ jurorId: `JUROR_YES_${i}`, voteForClaimant: true, stakeCents: 100_000_00 });
    }
    for (let i = 0; i < 10; i++) {
      votes.push({ jurorId: `JUROR_NO_${i}`, voteForClaimant: false, stakeCents: 100_000_00 });
    }

    const ruling = arbitratePanDimensionalConclaveDispute({
      disputeCaseRef: 'DISPUTE_PAN_DIMENSIONAL_002',
      claimantParticipantId: 'A',
      respondentParticipantId: 'B',
      disputeValueCents: 10_000_000_00,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes,
      supermajorityThresholdPct: 99.9,
    });

    expect(ruling.verdict).toBe('DELIBERATING');
    expect(ruling.jurorsSlashedCount).toBe(0);
    expect(ruling.executedRemedyCents).toBe(0);
  });

  it('strictly protects immutable Pan-Dimensional constitutional invariants', () => {
    const invariant: PanDimensionalConstitutionalInvariant = {
      articleCode: 'ART-001-IRREVOCABLE-FINALITY',
      articleTitle: 'Sub-500ps Quantum Settlement Irrevocability',
      isStrictlyImmutable: true,
      enforcementCircuitHash: 'hash123',
      lastTheoremVerifiedAt: new Date().toISOString(),
    };

    const breachAttempt = verifyPanDimensionalConstitutionalInvariant(
      invariant,
      'OVERRIDE_CONSTITUTIONAL_FINALITY_ROLLBACK'
    );

    expect(breachAttempt.allowed).toBe(false);
    expect(breachAttempt.reason).toContain('strictly immutable');

    const permittedAction = verifyPanDimensionalConstitutionalInvariant(
      invariant,
      'AUDIT_AND_CONFIRM_FINALITY'
    );

    expect(permittedAction.allowed).toBe(true);

    const checkArray = verifyPanDimensionalConstitutionalInvariants([invariant], 'ART-001-IRREVOCABLE-FINALITY');
    expect(checkArray.allowed).toBe(false);
    expect(checkArray.isStrictlyImmutable).toBe(true);
  });
});
