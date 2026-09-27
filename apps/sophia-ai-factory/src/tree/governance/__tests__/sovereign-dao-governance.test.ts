import { describe, it, expect } from 'vitest';
import {
  evaluateDaoVoteTally,
  computeVoteMerkleLeaf,
} from '../sovereign-dao-governance';
import type { SovereignDaoProposal, DaoVoteReceipt } from '@/seed/types/quantum-dao';

describe('Sovereign DAO Governance Unit Tests', () => {
  const sampleProposal: SovereignDaoProposal = {
    id: 'prop_12',
    proposalNumber: 12,
    title: 'Authorize $25M Real-Time Central Bank Liquidity Vault',
    descriptionCid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
    proposerDid: 'did:sophia:quantum:founder',
    category: 'TREASURY_ALLOCATION',
    quorumThresholdTokens: 50_000_000,
    approvalThresholdBps: 6667, // 66.67%
    totalVotesCast: 0,
    yesVotesCast: 0,
    noVotesCast: 0,
    abstainVotesCast: 0,
    executionTimelockSeconds: 86400,
    status: 'ACTIVE',
    votingStartsAt: '2026-09-01T00:00:00Z',
    votingEndsAt: '2026-09-30T00:00:00Z',
    executedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
  };

  it('passes proposal when quorum and supermajority threshold are met', () => {
    const receipts: DaoVoteReceipt[] = [
      {
        id: '1',
        proposalId: 'prop_12',
        voterDid: 'did:sophia:voter1',
        votingPowerWeight: 40_000_000,
        voteChoice: 'YES',
        quantumSignatureHex: 'sig_1',
        merkleLeafHash: 'leaf_1',
        castedAt: new Date().toISOString(),
      },
      {
        id: '2',
        proposalId: 'prop_12',
        voterDid: 'did:sophia:voter2',
        votingPowerWeight: 15_000_000,
        voteChoice: 'YES',
        quantumSignatureHex: 'sig_2',
        merkleLeafHash: 'leaf_2',
        castedAt: new Date().toISOString(),
      },
      {
        id: '3',
        proposalId: 'prop_12',
        voterDid: 'did:sophia:voter3',
        votingPowerWeight: 5_000_000,
        voteChoice: 'NO',
        quantumSignatureHex: 'sig_3',
        merkleLeafHash: 'leaf_3',
        castedAt: new Date().toISOString(),
      },
    ];

    const result = evaluateDaoVoteTally(sampleProposal, receipts);

    expect(result.totalVotesCast).toBe(60_000_000);
    expect(result.yesVotesCast).toBe(55_000_000);
    expect(result.noVotesCast).toBe(5_000_000);
    expect(result.quorumReached).toBe(true);
    // 55M / 60M = 91.67%
    expect(result.approvalPercentageBps).toBe(9167);
    expect(result.isPassed).toBe(true);
  });

  it('fails proposal if quorum is not reached', () => {
    const receipts: DaoVoteReceipt[] = [
      {
        id: '1',
        proposalId: 'prop_12',
        voterDid: 'did:sophia:voter1',
        votingPowerWeight: 10_000_000, // < 50M quorum
        voteChoice: 'YES',
        quantumSignatureHex: 'sig_1',
        merkleLeafHash: 'leaf_1',
        castedAt: new Date().toISOString(),
      },
    ];

    const result = evaluateDaoVoteTally(sampleProposal, receipts);
    expect(result.quorumReached).toBe(false);
    expect(result.isPassed).toBe(false);
  });

  it('computes deterministic Merkle leaf hash for audit receipts', () => {
    const leaf1 = computeVoteMerkleLeaf({
      proposalId: 'prop_12',
      voterDid: 'did:sophia:voter1',
      weight: 1000,
      choice: 'YES',
    });
    const leaf2 = computeVoteMerkleLeaf({
      proposalId: 'prop_12',
      voterDid: 'did:sophia:voter1',
      weight: 1000,
      choice: 'YES',
    });

    expect(leaf1).toBe(leaf2);
    expect(leaf1.startsWith('merkle_leaf_')).toBe(true);
  });
});
