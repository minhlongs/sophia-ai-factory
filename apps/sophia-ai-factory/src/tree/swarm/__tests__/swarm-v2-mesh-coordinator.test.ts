/** @vitest-environment node */

/**
 * Unit Test Suite: Distributed Swarm 2.0 Raft-BFT Mesh Coordinator
 *
 * Validates:
 * 1. Byzantine quorum calculation (N >= 3f + 1, Quorum Q = 2f + 1)
 * 2. Sub-10ms heartbeat latency EMA tracking and SLA conformance
 * 3. PBFT 3-phase state replication (Pre-prepare -> Prepare -> Commit) with quorum verification
 * 4. Chained audit state hash tamper-evident verification
 * 5. Byzantine split-brain network partition detection & majority arbitration
 * 6. Leader election with term advancement in D1
 *
 * @module tree/swarm/__tests__/swarm-v2-mesh-coordinator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type {
  SwarmV2ConsensusState,
  CrossBorderClearingBatch,
  SwarmNodeHealth,
} from '@/seed/types/multi-asset-clearing';
import {
  calculateByzantineQuorum,
  recordHeartbeat,
  updateSwarmV2Heartbeat,
  replicateBatchProposal,
  detectAndArbitrateSplitBrain,
  electSwarmV2Leader,
  getSwarmV2State,
  computeConsensusHash,
} from '../swarm-v2-mesh-coordinator';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Distributed Swarm 2.0 Raft-BFT Coordinator — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  const initialClusterState: SwarmV2ConsensusState = {
    id: 'state_mesh_v2_global',
    term: 1,
    leaderNodeId: 'node_apac_coordinator_01',
    consensusProtocol: 'RAFT_BFT',
    clusterEpoch: 1,
    viewNumber: 0,
    commitIndex: 100,
    lastAppliedIndex: 100,
    quorumSize: 3,
    activeVotersCount: 5,
    byzantineToleranceF: 1,
    avgHeartbeatLatencyMs: 4.35,
    p99HeartbeatLatencyMs: 8.12,
    isQuorumHealthy: true,
    splitBrainDetected: false,
    lastLeaderElectionAt: 1700000000000,
    lastHeartbeatRoundAt: 1700000000000,
    membershipNodes: [
      'node_apac_coordinator_01',
      'node_apac_sales_01',
      'node_apac_healer_01',
      'node_us_sales_01',
      'node_eu_healer_01',
    ],
    auditStateHash: '0000000000000000000000000000000000000000000000000000000000000000',
    updatedAt: 1700000000000,
  };

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS swarm_v2_consensus_state (
        id TEXT PRIMARY KEY,
        term INTEGER NOT NULL DEFAULT 0,
        leader_node_id TEXT,
        consensus_protocol TEXT NOT NULL DEFAULT 'RAFT_BFT',
        cluster_epoch INTEGER NOT NULL DEFAULT 1,
        view_number INTEGER NOT NULL DEFAULT 0,
        commit_index INTEGER NOT NULL DEFAULT 0,
        last_applied_index INTEGER NOT NULL DEFAULT 0,
        quorum_size INTEGER NOT NULL DEFAULT 3,
        active_voters_count INTEGER NOT NULL DEFAULT 1,
        byzantine_tolerance_f INTEGER NOT NULL DEFAULT 1,
        avg_heartbeat_latency_ms REAL NOT NULL DEFAULT 0.0,
        p99_heartbeat_latency_ms REAL NOT NULL DEFAULT 0.0,
        is_quorum_healthy INTEGER NOT NULL DEFAULT 1,
        split_brain_detected INTEGER NOT NULL DEFAULT 0,
        last_leader_election_at INTEGER NOT NULL,
        last_heartbeat_round_at INTEGER NOT NULL,
        membership_nodes_json TEXT NOT NULL DEFAULT '[]',
        audit_state_hash TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO swarm_v2_consensus_state (
        id, term, leader_node_id, consensus_protocol, cluster_epoch, view_number,
        commit_index, last_applied_index, quorum_size, active_voters_count,
        byzantine_tolerance_f, avg_heartbeat_latency_ms, p99_heartbeat_latency_ms,
        is_quorum_healthy, split_brain_detected, last_leader_election_at,
        last_heartbeat_round_at, membership_nodes_json, audit_state_hash, updated_at
      ) VALUES (
        'state_mesh_v2_global', 1, 'node_apac_coordinator_01', 'RAFT_BFT', 1, 0,
        100, 100, 3, 5, 1, 4.35, 8.12, 1, 0, 1700000000000, 1700000000000,
        '["node_apac_coordinator_01", "node_apac_sales_01", "node_apac_healer_01", "node_us_sales_01", "node_eu_healer_01"]',
        '0000000000000000000000000000000000000000000000000000000000000000', 1700000000000
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('1. Byzantine Quorum Formulations (N >= 3f + 1, Q = 2f + 1)', () => {
    it('accurately computes fault tolerance f and quorum threshold Q across cluster scales', () => {
      // 1 node cluster
      expect(calculateByzantineQuorum(1)).toEqual({ byzantineToleranceF: 0, quorumSize: 1 });
      // 3 nodes cluster (f=0, Q=1)
      expect(calculateByzantineQuorum(3)).toEqual({ byzantineToleranceF: 0, quorumSize: 1 });
      // 4 nodes cluster: 3(1)+1=4 => f=1, Q=3
      expect(calculateByzantineQuorum(4)).toEqual({ byzantineToleranceF: 1, quorumSize: 3 });
      // 5 nodes cluster: f=1, Q=3
      expect(calculateByzantineQuorum(5)).toEqual({ byzantineToleranceF: 1, quorumSize: 3 });
      // 7 nodes cluster: f=2, Q=5
      expect(calculateByzantineQuorum(7)).toEqual({ byzantineToleranceF: 2, quorumSize: 5 });
      // 10 nodes cluster: f=3, Q=7
      expect(calculateByzantineQuorum(10)).toEqual({ byzantineToleranceF: 3, quorumSize: 7 });
    });
  });

  describe('2. Sub-10ms Heartbeat Profiling', () => {
    it('maintains sub-10ms average latency with EMA smoothing when pings are rapid', () => {
      const telemetry = recordHeartbeat(initialClusterState, {
        nodeId: 'node_apac_sales_01',
        roundTripLatencyMs: 5.2,
        term: 1,
        commitIndex: 100,
      });

      expect(telemetry.acknowledged).toBe(true);
      expect(telemetry.isSub10ms).toBe(true);
      expect(telemetry.avgHeartbeatLatencyMs).toBeLessThan(10.0);
      expect(telemetry.isQuorumHealthy).toBe(true);
    });

    it('detects latency spikes and updates D1 persistence', async () => {
      const telemetry = await updateSwarmV2Heartbeat(db, {
        nodeId: 'node_us_sales_01',
        roundTripLatencyMs: 8.5,
        term: 1,
        commitIndex: 100,
      });

      expect(telemetry.acknowledged).toBe(true);
      expect(telemetry.avgHeartbeatLatencyMs).toBeLessThan(10.0);

      const state = await getSwarmV2State(db);
      expect(state?.avgHeartbeatLatencyMs).toBe(telemetry.avgHeartbeatLatencyMs);
      expect(state?.isQuorumHealthy).toBe(true);
    });
  });

  describe('3. PBFT 3-Phase State Replication for Financial Batches', () => {
    const mockBatch: CrossBorderClearingBatch = {
      id: 'cbb_20270926_100',
      batchReference: 'RTGS-20270926-100',
      batchCycle: 'instant_rtgs',
      sourceAsset: 'USD',
      targetAsset: 'USDT',
      grossAmount: 5000.0,
      netClearedAmount: 4998.50,
      clearingFeeAmount: 1.0,
      slippageRealizedPct: 0.01,
      settlementType: 'T0_RTGS',
      reconciliationStatus: 'pending',
      bankingPartnerRef: null,
      iso20022MessageId: 'pacs.008.test',
      participantCount: 1,
      poolId: 'pool_usdt_primary',
      status: 'cleared',
      merkleRootHash: 'hash-test-01',
      settledAt: Date.now(),
      reconciledAt: null,
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('successfully commits batch proposal when 2f+1 quorum approvals are collected', async () => {
      // 5 nodes, Q=3 approvals needed. Provide signatures from 3 distinct voter nodes.
      const signatures = {
        node_apac_coordinator_01: 'sig-01',
        node_apac_sales_01: 'sig-02',
        node_apac_healer_01: 'sig-03',
      };

      const result = await replicateBatchProposal(db, initialClusterState, mockBatch, signatures);

      expect(result.committed).toBe(true);
      expect(result.approvalsCollected).toBe(3);
      expect(result.commitIndex).toBe(101);
      expect(result.auditStateHash).not.toBe(initialClusterState.auditStateHash);
      expect(result.digest).toHaveLength(64);

      // Verify D1 state updated
      const updatedState = await getSwarmV2State(db);
      expect(updatedState?.commitIndex).toBe(101);
      expect(updatedState?.auditStateHash).toBe(result.auditStateHash);
    });

    it('rejects batch proposal when approvals fail to meet Byzantine quorum threshold', async () => {
      // Provide only 1 signature when Q=3 is required
      const signatures = {
        node_apac_coordinator_01: 'sig-01',
      };

      const result = await replicateBatchProposal(db, initialClusterState, mockBatch, signatures);

      expect(result.committed).toBe(false);
      expect(result.approvalsCollected).toBe(1);
      expect(result.commitIndex).toBe(100); // Unchanged

      const unchangedState = await getSwarmV2State(db);
      expect(unchangedState?.commitIndex).toBe(100);
    });
  });

  describe('4. Byzantine Split-Brain Detection & Arbitration', () => {
    it('maintains leader in majority partition and demotes/isolates minority partition', () => {
      // Cluster of 5 nodes: Partition A has 3 nodes (Term 2), Partition B has 2 nodes (Term 1)
      const nodes: SwarmNodeHealth[] = [
        { nodeId: 'node_01', region: 'apac', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 4.0, term: 2, commitIndex: 105 },
        { nodeId: 'node_02', region: 'apac', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 4.5, term: 2, commitIndex: 105 },
        { nodeId: 'node_03', region: 'apac', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 5.0, term: 2, commitIndex: 105 },
        { nodeId: 'node_04', region: 'us', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 6.0, term: 1, commitIndex: 103 },
        { nodeId: 'node_05', region: 'eu', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 7.0, term: 1, commitIndex: 103 },
      ];

      const arbitration = detectAndArbitrateSplitBrain(nodes, {
        ...initialClusterState,
        leaderNodeId: 'node_01',
      });

      expect(arbitration.splitBrainDetected).toBe(true);
      expect(arbitration.arbitrationAction).toBe('MAINTAIN_LEADER');
      expect(arbitration.majorityPartitionNodes).toEqual(['node_01', 'node_02', 'node_03']);
      expect(arbitration.minorityPartitionNodes).toEqual(['node_04', 'node_05']);
      expect(arbitration.isolatedNodes).toEqual(['node_04', 'node_05']);
      expect(arbitration.activeLeaderId).toBe('node_01');
    });

    it('triggers EMERGENCY_QUORUM_LOST when neither partition achieves Byzantine quorum', () => {
      // 5 total nodes: 2 in Partition A, 2 in Partition B, 1 offline
      const nodes: SwarmNodeHealth[] = [
        { nodeId: 'node_01', region: 'apac', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 4.0, term: 2, commitIndex: 105 },
        { nodeId: 'node_02', region: 'apac', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 4.5, term: 2, commitIndex: 105 },
        { nodeId: 'node_03', region: 'us', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 5.0, term: 3, commitIndex: 106 },
        { nodeId: 'node_04', region: 'us', status: 'active', lastHeartbeatAt: Date.now(), avgLatencyMs: 5.5, term: 3, commitIndex: 106 },
        { nodeId: 'node_05', region: 'eu', status: 'offline', lastHeartbeatAt: Date.now() - 100000, avgLatencyMs: 99.0, term: 1, commitIndex: 100 },
      ];

      const arbitration = detectAndArbitrateSplitBrain(nodes);

      expect(arbitration.splitBrainDetected).toBe(true);
      expect(arbitration.arbitrationAction).toBe('EMERGENCY_QUORUM_LOST');
      expect(arbitration.activeLeaderId).toBeNull();
    });
  });

  describe('5. Consensus Leader Election & State Queries', () => {
    it('elects new cluster leader, advances election term and records timestamp', async () => {
      const updated = await electSwarmV2Leader(db, 'node_apac_sales_01');

      expect(updated.leaderNodeId).toBe('node_apac_sales_01');
      expect(updated.term).toBe(2); // Term incremented from 1 to 2
      expect(updated.lastLeaderElectionAt).toBeGreaterThan(1700000000000);

      const fetched = await getSwarmV2State(db);
      expect(fetched?.leaderNodeId).toBe('node_apac_sales_01');
      expect(fetched?.term).toBe(2);
    });
  });
});
