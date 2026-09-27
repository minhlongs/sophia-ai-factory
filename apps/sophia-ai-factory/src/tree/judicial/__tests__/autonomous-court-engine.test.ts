import { describe, it, expect } from 'vitest';
import {
  adjudicateDisputeCase,
  validateAppealEligibility,
} from '../autonomous-court-engine';
import type {
  JudicialDisputeCase,
  JurorBallot,
} from '@/seed/types/fhe-court';

describe('Autonomous Judicial Court Engine Unit Tests', () => {
  const disputeCase: JudicialDisputeCase = {
    id: 'case_001',
    caseNumber: 'CASE_2026_AI_0901',
    claimantIdentityHash: '0xclaimant1234',
    respondentIdentityHash: '0xrespondent5678',
    disputeCategory: 'SLA_BREACH',
    disputedAmountCents: 10_000_000, // $100K
    escrowBondCents: 15_000_000,     // $150K
    evidenceMerkleRoot: 'e'.repeat(64),
    assignedJurorCount: 7,
    verdictThresholdRatio: 0.714,    // 5/7 = 71.4%
    appealWindowExpiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), // 72 hours from now
    status: 'JUROR_DELIBERATION',
    createdAt: '2026-09-27T00:00:00Z',
  };

  it('renders CLAIMANT_FAVORED verdict when affirmative votes reach supermajority and slashes minority', () => {
    // 6 affirmative, 1 dissenting (6/7 = 85.7% > 71.4%)
    const ballots: JurorBallot[] = [
      { jurorAddress: 'juror_1', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h1' },
      { jurorAddress: 'juror_2', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h2' },
      { jurorAddress: 'juror_3', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h3' },
      { jurorAddress: 'juror_4', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h4' },
      { jurorAddress: 'juror_5', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h5' },
      { jurorAddress: 'juror_6', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h6' },
      { jurorAddress: 'juror_7', vote: 'DISSENTING', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h7' },
    ];

    const verdict = adjudicateDisputeCase(disputeCase, ballots);
    expect(verdict.verdictOutcome).toBe('CLAIMANT_FAVORED');
    expect(verdict.affirmativeVotes).toBe(6);
    expect(verdict.dissentingVotes).toBe(1);
    // Slashed 20% of dissenting stake ($10,000 * 20% = $2,000)
    expect(verdict.slashedJurorStakesCents).toBe(200_000);
    expect(verdict.disbursedCompensationCents).toBeGreaterThan(0);
    expect(verdict.zeroKnowledgeProofHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verdict.formalVerificationPassed).toBe(true);
  });

  it('renders SPLIT_SETTLEMENT when neither side achieves supermajority threshold', () => {
    // 4 affirmative, 3 dissenting (4/7 = 57.1% < 71.4%)
    const ballots: JurorBallot[] = [
      { jurorAddress: 'juror_1', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h1' },
      { jurorAddress: 'juror_2', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h2' },
      { jurorAddress: 'juror_3', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h3' },
      { jurorAddress: 'juror_4', vote: 'AFFIRMATIVE', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h4' },
      { jurorAddress: 'juror_5', vote: 'DISSENTING', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h5' },
      { jurorAddress: 'juror_6', vote: 'DISSENTING', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h6' },
      { jurorAddress: 'juror_7', vote: 'DISSENTING', stakeWeightCents: 1_000_000, zkCommitmentHash: 'h7' },
    ];

    const verdict = adjudicateDisputeCase(disputeCase, ballots);
    expect(verdict.verdictOutcome).toBe('SPLIT_SETTLEMENT');
    expect(verdict.slashedJurorStakesCents).toBe(0);
    expect(verdict.disbursedCompensationCents).toBe(5_000_000); // 50% of $100K
  });

  it('validates appeal eligibility against 72h window and required bond', () => {
    const requiredBond = 22_500_000; // 150% of $150K
    const validAppeal = validateAppealEligibility(disputeCase, requiredBond);
    expect(validAppeal.eligible).toBe(true);

    const insufficientBond = validateAppealEligibility(disputeCase, 10_000_000);
    expect(insufficientBond.eligible).toBe(false);
    expect(insufficientBond.reason).toContain('below required');

    // Expired appeal window
    const pastTimestamp = Date.now() + 100 * 3600 * 1000;
    const expiredAppeal = validateAppealEligibility(disputeCase, requiredBond, pastTimestamp);
    expect(expiredAppeal.eligible).toBe(false);
    expect(expiredAppeal.reason).toContain('Appeal window has expired');
  });
});
