import { describe, it, expect } from 'vitest';
import { evaluateConstitutionalAmendment } from '../constitutional-amendment-engine';
import type { ConstitutionalAmendmentProposal } from '@/seed/types/zk-mpc-constitution';

describe('Constitutional Amendment Engine Unit Tests', () => {
  const validProposal: ConstitutionalAmendmentProposal = {
    id: 'prop_01',
    articleReference: 'CONST_ARTICLE_XVIII_INTERSTELLAR_QUANTUM_COUNCIL',
    title: 'Establish Interstellar Quantum Council for Grid Load Balancing',
    proposedDiffJson: JSON.stringify({ additions: ['Article XVIII Section 1'] }),
    sponsoringSovereignEntity: 'SINGAPORE_SOVEREIGN_AI_NODE',
    supermajorityRequirementBps: 7500, // 75.00%
    affirmativeVotingPowerWeight: 0,
    dissentingVotingPowerWeight: 0,
    formalVerificationPassed: true,
    antiTakeoverGuardrailIntact: true,
    ratificationStatus: 'PROPOSED',
    timelockEnactmentAt: '',
    createdAt: '2026-09-27T00:00:00Z',
  };

  it('ratifies amendment when supermajority (>= 75%) is achieved and formal verification passes', () => {
    // 80% affirmative (80,000 vs 20,000)
    const result = evaluateConstitutionalAmendment(validProposal, 80_000, 20_000);
    expect(result.ratificationStatus).toBe('RATIFIED_INTO_LAW');
    expect(result.isSupermajorityMet).toBe(true);
    expect(result.affirmativeRatioBps).toBe(8000);
    expect(result.antiTakeoverGuardrailIntact).toBe(true);
    expect(result.timelockEnactmentAt).toBeDefined();
  });

  it('blocks amendment and marks DELIBERATING if voting power is below supermajority threshold', () => {
    // 70% affirmative (< 75%)
    const result = evaluateConstitutionalAmendment(validProposal, 70_000, 30_000);
    expect(result.ratificationStatus).toBe('DELIBERATING');
    expect(result.isSupermajorityMet).toBe(false);
    expect(result.rejectionReason).toContain('has not reached required supermajority');
  });

  it('vetoes amendments attempting to alter immutable articles (anti-takeover guardrail)', () => {
    const takeoverProposal: ConstitutionalAmendmentProposal = {
      ...validProposal,
      articleReference: 'CONST_ARTICLE_I_FUNDAMENTAL_HUMAN_SOVEREIGNTY',
    };

    const result = evaluateConstitutionalAmendment(takeoverProposal, 99_000, 1_000);
    expect(result.ratificationStatus).toBe('VETOED_UNCONSTITUTIONAL');
    expect(result.antiTakeoverGuardrailIntact).toBe(false);
    expect(result.rejectionReason).toContain('immutable under the Perpetual Sovereignty Charter');
  });

  it('vetoes unverified proposals that fail formal Lean 4 verification', () => {
    const unverifiedProposal: ConstitutionalAmendmentProposal = {
      ...validProposal,
      formalVerificationPassed: false,
    };

    const result = evaluateConstitutionalAmendment(unverifiedProposal, 90_000, 10_000);
    expect(result.ratificationStatus).toBe('VETOED_UNCONSTITUTIONAL');
    expect(result.rejectionReason).toContain('failed formal mathematical verification');
  });
});
