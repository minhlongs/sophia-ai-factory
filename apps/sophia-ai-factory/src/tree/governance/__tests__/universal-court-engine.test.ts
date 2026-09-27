/**
 * @file universal-court-engine.test.ts
 * @layer tree/governance
 * @description Unit tests for Autonomous Universal Supreme Court arbitration & immutable invariant checks.
 */

import { describe, it, expect } from 'vitest';
import {
  arbitrateUniversalDispute,
  verifyUniversalConstitutionalInvariants,
} from '../universal-court-engine';
import type { UniversalJurorVote, UniversalConstitutionalInvariant } from '@/seed/types/zk-stark-constitution';

describe('UniversalCourtEngine', () => {
  it('dismisses dispute with DISMISSED_NO_JURISDICTION when no jurors vote', () => {
    const verdict = arbitrateUniversalDispute({
      disputeCaseRef: 'DISP-000',
      claimantParticipantId: 'user-001',
      respondentParticipantId: 'user-002',
      disputeValueCents: 10_000_000,
      evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      votes: [],
    });

    expect(verdict.verdict).toBe('DISMISSED_NO_JURISDICTION');
    expect(verdict.totalJurors).toBe(0);
    expect(verdict.executedRemedyCents).toBe(0);
    expect(verdict.jurorsSlashedCount).toBe(0);
  });

  it('rules CLAIMANT_PREVAILS with >=80% supermajority and slashes 30% minority stake', () => {
    // 10 jurors: 8 vote for claimant (80%), 2 vote for respondent
    const votes: UniversalJurorVote[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        jurorId: `juror-claimant-${i}`,
        voteForClaimant: true,
        stakeCents: 1_000_000, // $10,000 stake each
        rationale: 'Evidence is conclusive',
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        jurorId: `juror-respondent-${i}`,
        voteForClaimant: false,
        stakeCents: 1_000_000,
        rationale: 'Evidence is insufficient',
      })),
    ];

    const verdict = arbitrateUniversalDispute({
      disputeCaseRef: 'DISP-001',
      claimantParticipantId: 'user-001',
      respondentParticipantId: 'user-002',
      disputeValueCents: 50_000_000, // $500,000
      evidenceSha256: 'abc123456789',
      votes,
    });

    expect(verdict.verdict).toBe('CLAIMANT_PREVAILS');
    expect(verdict.effectiveSupermajorityPct).toBe(80);
    expect(verdict.executedRemedyCents).toBe(50_000_000);
    expect(verdict.jurorsSlashedCount).toBe(2);
    // 30% of 2 * 1,000,000 = 600,000 cents ($6,000)
    expect(verdict.totalSlashedStakeCents).toBe(600_000);
  });

  it('rules RESPONDENT_PREVAILS when respondent achieves supermajority and slashes claimant votes', () => {
    // 10 jurors: 1 for claimant, 9 for respondent (90%)
    const votes: UniversalJurorVote[] = [
      {
        jurorId: 'juror-solo',
        voteForClaimant: true,
        stakeCents: 2_000_000,
        rationale: 'Fault lies with respondent',
      },
      ...Array.from({ length: 9 }, (_, i) => ({
        jurorId: `juror-resp-${i}`,
        voteForClaimant: false,
        stakeCents: 1_000_000,
        rationale: 'Claimant lacks proof',
      })),
    ];

    const verdict = arbitrateUniversalDispute({
      disputeCaseRef: 'DISP-002',
      claimantParticipantId: 'user-001',
      respondentParticipantId: 'user-002',
      disputeValueCents: 25_000_000,
      evidenceSha256: 'def456789',
      votes,
    });

    expect(verdict.verdict).toBe('RESPONDENT_PREVAILS');
    expect(verdict.effectiveSupermajorityPct).toBe(90);
    expect(verdict.executedRemedyCents).toBe(0);
    expect(verdict.jurorsSlashedCount).toBe(1);
    expect(verdict.totalSlashedStakeCents).toBe(600_000); // 30% of 2,000,000 = 600,000
  });

  it('remains DELIBERATING when no side reaches 80% supermajority and slashes 0 stake', () => {
    // 10 jurors: 7 for claimant (70%), 3 for respondent (30%)
    const votes: UniversalJurorVote[] = [
      ...Array.from({ length: 7 }, (_, i) => ({
        jurorId: `juror-c-${i}`,
        voteForClaimant: true,
        stakeCents: 1_000_000,
        rationale: 'Claimant right',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        jurorId: `juror-r-${i}`,
        voteForClaimant: false,
        stakeCents: 1_000_000,
        rationale: 'Respondent right',
      })),
    ];

    const verdict = arbitrateUniversalDispute({
      disputeCaseRef: 'DISP-003',
      claimantParticipantId: 'user-001',
      respondentParticipantId: 'user-002',
      disputeValueCents: 10_000_000,
      evidenceSha256: 'ghi789',
      votes,
    });

    expect(verdict.verdict).toBe('DELIBERATING');
    expect(verdict.jurorsSlashedCount).toBe(0);
    expect(verdict.totalSlashedStakeCents).toBe(0);
    expect(verdict.executedRemedyCents).toBe(0);
  });

  it('rejects changes to strictly immutable articles and permits changes to mutable articles', () => {
    const invariants: UniversalConstitutionalInvariant[] = [
      {
        articleCode: 'ART_01_REPUTATION_IMMUTABILITY',
        articleTitle: 'Universal Immutability of Cryptographic Reputation',
        isStrictlyImmutable: true,
        enactedTimestampMicros: 1700000000,
        sha512EnactmentProof: 'deadbeef123',
      },
      {
        articleCode: 'ART_09_OPERATIONAL_FEE_SCHEDULE',
        articleTitle: 'Dynamic Micro-Gas Pricing Model',
        isStrictlyImmutable: false,
        enactedTimestampMicros: 1700000000,
        sha512EnactmentProof: 'cafebabe456',
      },
    ];

    const immutableCheck = verifyUniversalConstitutionalInvariants(
      invariants,
      'ART_01_REPUTATION_IMMUTABILITY'
    );
    expect(immutableCheck.allowed).toBe(false);
    expect(immutableCheck.violationReason).toContain('strictly immutable');

    const mutableCheck = verifyUniversalConstitutionalInvariants(
      invariants,
      'ART_09_OPERATIONAL_FEE_SCHEDULE'
    );
    expect(mutableCheck.allowed).toBe(true);
    expect(mutableCheck.violationReason).toBeUndefined();
  });
});
