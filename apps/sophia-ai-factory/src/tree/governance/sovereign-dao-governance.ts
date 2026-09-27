/**
 * sovereign-dao-governance.ts — Tree Layer Pure Domain Engine
 * Sovereign AI DAO Governance & Quorum Threshold Consensus Engine
 */

import type {
  SovereignDaoProposal,
  DaoVoteReceipt,
  DaoVoteChoice,
} from '@/seed/types/quantum-dao';

export interface VoteTallyResult {
  proposalId: string;
  totalVotesCast: number;
  yesVotesCast: number;
  noVotesCast: number;
  abstainVotesCast: number;
  quorumReached: boolean;
  approvalPercentageBps: number;
  isPassed: boolean;
}

/**
 * Evaluates the outcome of a DAO proposal vote
 */
export function evaluateDaoVoteTally(
  proposal: SovereignDaoProposal,
  receipts: DaoVoteReceipt[],
): VoteTallyResult {
  let yesVotes = 0;
  let noVotes = 0;
  let abstainVotes = 0;
  let totalVotes = 0;

  for (const receipt of receipts) {
    if (receipt.proposalId !== proposal.id) continue;
    const weight = Math.max(0, receipt.votingPowerWeight);
    totalVotes += weight;

    if (receipt.voteChoice === 'YES') {
      yesVotes += weight;
    } else if (receipt.voteChoice === 'NO') {
      noVotes += weight;
    } else if (receipt.voteChoice === 'ABSTAIN') {
      abstainVotes += weight;
    }
  }

  const quorumReached = totalVotes >= proposal.quorumThresholdTokens;
  const decisiveVotes = yesVotes + noVotes;
  const approvalPercentageBps =
    decisiveVotes > 0 ? Math.round((yesVotes / decisiveVotes) * 10_000) : 0;

  const isPassed =
    quorumReached && approvalPercentageBps >= proposal.approvalThresholdBps;

  return {
    proposalId: proposal.id,
    totalVotesCast: totalVotes,
    yesVotesCast: yesVotes,
    noVotesCast: noVotes,
    abstainVotesCast: abstainVotes,
    quorumReached,
    approvalPercentageBps,
    isPassed,
  };
}

/**
 * Computes a Merkle leaf hash for a vote receipt
 */
export function computeVoteMerkleLeaf(receipt: {
  proposalId: string;
  voterDid: string;
  weight: number;
  choice: DaoVoteChoice;
}): string {
  const raw = `${receipt.proposalId}:${receipt.voterDid}:${receipt.weight}:${receipt.choice}`;
  let hash = 0xabcdef01;
  for (let i = 0; i < raw.length; i++) {
    hash = Math.imul(hash ^ raw.charCodeAt(i), 2166136261);
  }
  return `merkle_leaf_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
