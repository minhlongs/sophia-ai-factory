/**
 * Byzantine Split-Brain Network Partition Detection & Cluster Authority Arbitrator
 *
 * @module tree/swarm/mesh/split-brain-arbitrator
 */

import type {
  SwarmV2ConsensusState,
  SwarmNodeHealth,
  PartitionArbitrationResult,
} from '@/seed/types/multi-asset-clearing';
import { calculateByzantineQuorum } from './types';

/**
 * Detects split-brain network partitions and arbitrates cluster authority.
 * Resolves split-brain scenario by maintaining the majority partition (nodes >= 2f + 1)
 * and demoting/isolating nodes in the minority partition.
 */
export function detectAndArbitrateSplitBrain(
  nodes: SwarmNodeHealth[],
  currentState?: SwarmV2ConsensusState,
): PartitionArbitrationResult {
  const totalNodes = nodes.length;
  const { quorumSize } = calculateByzantineQuorum(totalNodes);

  // Group nodes into active/reachable and degraded/isolated
  const activeNodes = nodes.filter(
    (n) => (n.status === 'active' || n.status === 'degraded') && n.avgLatencyMs < 50.0,
  );

  // Group active nodes by term/epoch alignment to detect divergent branches
  const termGroups: Map<number, SwarmNodeHealth[]> = new Map();
  for (const node of activeNodes) {
    const list = termGroups.get(node.term) ?? [];
    list.push(node);
    termGroups.set(node.term, list);
  }

  // Find partition with maximum nodes
  let largestGroup: SwarmNodeHealth[] = [];
  let largestTerm = 0;

  for (const [term, group] of termGroups.entries()) {
    if (
      group.length > largestGroup.length ||
      (group.length === largestGroup.length && term > largestTerm)
    ) {
      largestGroup = group;
      largestTerm = term;
    }
  }

  const majorityNodeIds = largestGroup.map((n) => n.nodeId);
  const minorityNodes = nodes.filter((n) => !majorityNodeIds.includes(n.nodeId));
  const minorityNodeIds = minorityNodes.map((n) => n.nodeId);

  // Split brain detected if active nodes are divided into multiple disconnected groups
  // or if multiple distinct leaders exist
  const splitBrainDetected =
    (termGroups.size > 1 && totalNodes >= 3) ||
    (minorityNodeIds.length > 0 && minorityNodeIds.length >= Math.floor(totalNodes / 2));

  // Case 1: Majority partition meets or exceeds Byzantine quorum Q
  if (largestGroup.length >= quorumSize) {
    const leaderInMajority =
      currentState?.leaderNodeId && majorityNodeIds.includes(currentState.leaderNodeId)
        ? currentState.leaderNodeId
        : (majorityNodeIds[0] ?? null);

    return {
      splitBrainDetected,
      majorityPartitionNodes: majorityNodeIds,
      minorityPartitionNodes: minorityNodeIds,
      isolatedNodes: minorityNodeIds,
      activeLeaderId: leaderInMajority,
      arbitrationAction: 'MAINTAIN_LEADER',
    };
  }

  // Case 2: Neither partition achieves Byzantine Quorum (Network split into minority halves)
  return {
    splitBrainDetected: true,
    majorityPartitionNodes: majorityNodeIds,
    minorityPartitionNodes: minorityNodeIds,
    isolatedNodes: nodes.map((n) => n.nodeId),
    activeLeaderId: null,
    arbitrationAction: 'EMERGENCY_QUORUM_LOST',
  };
}
