/**
 * @file interstellar-senate-engine.test.ts
 * @layer tree/governance
 * @description Unit tests for Autonomous Interstellar Supreme Senate arbitration & invariant checks.
 */

import { describe, it, expect } from 'vitest';
import {
  arbitrateInterstellarDispute,
  verifyInterstellarConstitutionalInvariants,
} from '../interstellar-senate-engine';
import type {
  InterstellarJurorVote,
  InterstellarConstitutionalInvariant,
} from '@/seed/types/hyper-stark-senate';

describe('InterstellarSenateEngine', () => {
  it('dismisses dispute with DISMISSED_NO_JURISDICTION when no senators vote', () => {
    const verdict = arbitrateInterstellarDispute({
      disputeCaseRef: 'SENATE-DISP-000',
      claimantParticipantId: 'consortium-001',
      respondentParticipantId: 'federation-002',
      disputeValueCents: 10_000_000,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes: [],
    });

    expect(verdict.verdict).toBe('DISMISSED_NO_JURISDICTION');
    expect(verdict.totalSenators).toBe(0);
    expect(verdict.executedRemedyCents).toBe(0);
    expect(verdict.senatorsSlashedCount).toBe(0);
  });

  it('rules CLAIMANT_PREVAILS with >=85% supermajority and slashes 35% minority stake', () => {
    // 20 senators: 17 for claimant (85%), 3 for respondent
    const votes: InterstellarJurorVote[] = [
      ...Array.from({ length: 17 }, (_, i) => ({
        jurorId: `senator-claimant-${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_000, // $100,000 stake each
        rationale: 'Breach of interstellar treaty',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        jurorId: `senator-respondent-${i}`,
        voteForClaimant: false,
        stakeCents: 10_000_000,
        rationale: 'Jurisdictional ambiguity',
      })),
    ];

    const verdict = arbitrateInterstellarDispute({
      disputeCaseRef: 'SENATE-DISP-001',
      claimantParticipantId: 'node-alpha',
      respondentParticipantId: 'node-beta',
      disputeValueCents: 100_000_000_00, // $100M
      evidenceSha256: 'deadbeef123',
      votes,
    });

    expect(verdict.verdict).toBe('CLAIMANT_PREVAILS');
    expect(verdict.effectiveSupermajorityPct).toBe(85);
    expect(verdict.executedRemedyCents).toBe(100_000_000_00);
    expect(verdict.senatorsSlashedCount).toBe(3);
    // 35% of 3 * 10,000,000 = 10,500,000 cents ($105k)
    expect(verdict.totalSlashedStakeCents).toBe(10_500_000);
  });

  it('rules RESPONDENT_PREVAILS when respondent reaches >=85% supermajority', () => {
    // 20 senators: 2 for claimant, 18 for respondent (90%)
    const votes: InterstellarJurorVote[] = [
      ...Array.from({ length: 2 }, (_, i) => ({
        jurorId: `senator-c-${i}`,
        voteForClaimant: true,
        stakeCents: 20_000_000,
      })),
      ...Array.from({ length: 18 }, (_, i) => ({
        jurorId: `senator-r-${i}`,
        voteForClaimant: false,
        stakeCents: 10_000_000,
      })),
    ];

    const verdict = arbitrateInterstellarDispute({
      disputeCaseRef: 'SENATE-DISP-002',
      claimantParticipantId: 'node-alpha',
      respondentParticipantId: 'node-beta',
      disputeValueCents: 50_000_000_00,
      evidenceSha256: 'cafebabe456',
      votes,
    });

    expect(verdict.verdict).toBe('RESPONDENT_PREVAILS');
    expect(verdict.effectiveSupermajorityPct).toBe(90);
    expect(verdict.executedRemedyCents).toBe(0);
    expect(verdict.senatorsSlashedCount).toBe(2);
    // 35% of 2 * 20,000,000 = 14,000,000 cents
    expect(verdict.totalSlashedStakeCents).toBe(14_000_000);
  });

  it('remains DELIBERATING when neither side reaches 85% supermajority', () => {
    // 20 senators: 16 for claimant (80%), 4 for respondent (20%) -> 80% < 85% threshold
    const votes: InterstellarJurorVote[] = [
      ...Array.from({ length: 16 }, (_, i) => ({
        jurorId: `senator-c-${i}`,
        voteForClaimant: true,
        stakeCents: 10_000_000,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        jurorId: `senator-r-${i}`,
        voteForClaimant: false,
        stakeCents: 10_000_000,
      })),
    ];

    const verdict = arbitrateInterstellarDispute({
      disputeCaseRef: 'SENATE-DISP-003',
      claimantParticipantId: 'node-alpha',
      respondentParticipantId: 'node-beta',
      disputeValueCents: 20_000_000_00,
      evidenceSha256: 'hash789',
      votes,
    });

    expect(verdict.verdict).toBe('DELIBERATING');
    expect(verdict.senatorsSlashedCount).toBe(0);
    expect(verdict.totalSlashedStakeCents).toBe(0);
    expect(verdict.executedRemedyCents).toBe(0);
  });

  it('rejects amendment to strictly immutable articles and permits amendment to mutable articles', () => {
    const invariants: InterstellarConstitutionalInvariant[] = [
      {
        articleCode: 'ART_001_SENTIENT_AUTONOMY',
        articleTitle: 'Preservation of Sentient Consciousness Autonomy',
        isStrictlyImmutable: true,
      },
      {
        articleCode: 'ART_088_GAS_BANDWIDTH_LIMITS',
        articleTitle: 'Tachyon Network Gas Limit Optimization',
        isStrictlyImmutable: false,
      },
    ];

    const immutableCheck = verifyInterstellarConstitutionalInvariants(
      invariants,
      'ART_001_SENTIENT_AUTONOMY'
    );
    expect(immutableCheck.allowed).toBe(false);
    expect(immutableCheck.violationReason).toContain('strictly immutable');

    const mutableCheck = verifyInterstellarConstitutionalInvariants(
      invariants,
      'ART_088_GAS_BANDWIDTH_LIMITS'
    );
    expect(mutableCheck.allowed).toBe(true);
    expect(mutableCheck.violationReason).toBeUndefined();
  });
});
