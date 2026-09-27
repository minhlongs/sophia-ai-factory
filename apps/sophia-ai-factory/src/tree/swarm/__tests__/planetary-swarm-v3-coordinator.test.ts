/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import type { PlanetarySwarmNode, SpotBidRequest } from '@/seed/types/planetary-swarm';
import { PlanetarySwarmV3Coordinator } from '../planetary-swarm-v3-coordinator';

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

describe('PlanetarySwarmV3Coordinator — Unit Tests', () => {
  let db: D1Database;

  const mockNodes: PlanetarySwarmNode[] = [
    {
      id: 'node_iad_1',
      nodeKey: 'key_iad_1',
      continent: 'NORTH_AMERICA',
      datacenterCode: 'IAD-01',
      ipAddressHash: 'hash_iad_1',
      ed25519PublicKey: 'ed_pub_iad_1',
      status: 'ONLINE',
      consensusRole: 'VALIDATOR',
      heartbeatLatencyMs: 6,
      uptimePercentage: 99.9999,
      lastHeartbeatAt: '2026-09-27T00:00:00Z',
      registeredAt: '2026-09-27T00:00:00Z',
    },
    {
      id: 'node_fra_1',
      nodeKey: 'key_fra_1',
      continent: 'EUROPE',
      datacenterCode: 'FRA-01',
      ipAddressHash: 'hash_fra_1',
      ed25519PublicKey: 'ed_pub_fra_1',
      status: 'ONLINE',
      consensusRole: 'VALIDATOR',
      heartbeatLatencyMs: 8,
      uptimePercentage: 99.9999,
      lastHeartbeatAt: '2026-09-27T00:00:00Z',
      registeredAt: '2026-09-27T00:00:00Z',
    },
    {
      id: 'node_sin_1',
      nodeKey: 'key_sin_1',
      continent: 'ASIA_PACIFIC',
      datacenterCode: 'SIN-01',
      ipAddressHash: 'hash_sin_1',
      ed25519PublicKey: 'ed_pub_sin_1',
      status: 'ONLINE',
      consensusRole: 'VALIDATOR',
      heartbeatLatencyMs: 9,
      uptimePercentage: 99.9999,
      lastHeartbeatAt: '2026-09-27T00:00:00Z',
      registeredAt: '2026-09-27T00:00:00Z',
    },
    {
      id: 'node_nrt_1',
      nodeKey: 'key_nrt_1',
      continent: 'ASIA_PACIFIC',
      datacenterCode: 'NRT-01',
      ipAddressHash: 'hash_nrt_1',
      ed25519PublicKey: 'ed_pub_nrt_1',
      status: 'ONLINE',
      consensusRole: 'VALIDATOR',
      heartbeatLatencyMs: 12,
      uptimePercentage: 99.9999,
      lastHeartbeatAt: '2026-09-27T00:00:00Z',
      registeredAt: '2026-09-27T00:00:00Z',
    },
  ];

  beforeEach(() => {
    const rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS planetary_swarm_nodes (
        id TEXT PRIMARY KEY,
        node_key TEXT NOT NULL UNIQUE,
        continent TEXT NOT NULL,
        datacenter_code TEXT NOT NULL,
        ip_address_hash TEXT NOT NULL,
        ed25519_public_key TEXT NOT NULL,
        status TEXT NOT NULL,
        consensus_role TEXT NOT NULL,
        heartbeat_latency_ms INTEGER NOT NULL,
        uptime_percentage REAL NOT NULL,
        last_heartbeat_at TEXT NOT NULL,
        registered_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agentic_spot_auctions (
        id TEXT PRIMARY KEY,
        auction_batch_id TEXT NOT NULL,
        seller_node_id TEXT NOT NULL,
        buyer_agent_did TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        units_allocated INTEGER NOT NULL,
        clearing_price_micros INTEGER NOT NULL,
        settlement_currency TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        bid_proof_hash TEXT NOT NULL,
        settlement_status TEXT NOT NULL,
        executed_at TEXT NOT NULL
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('1. Byzantine Quorum & Heartbeat Metrics', () => {
    it('evaluates quorum correctly when all 4 nodes are online', () => {
      const report = PlanetarySwarmV3Coordinator.evaluateByzantineQuorum(mockNodes);
      expect(report.totalNodes).toBe(4);
      expect(report.onlineNodes).toBe(4);
      expect(report.isByzantineQuorumMaintained).toBe(true);
      expect(report.continentsRepresented).toHaveLength(3);
      expect(report.averageHeartbeatLatencyMs).toBeLessThanOrEqual(10);
    });

    it('retains quorum when 1 node is partitioned (3/4 online > 66.7%)', () => {
      const degradedNodes = [...mockNodes];
      degradedNodes[3] = { ...degradedNodes[3], status: 'PARTITIONED' };

      const report = PlanetarySwarmV3Coordinator.evaluateByzantineQuorum(degradedNodes);
      expect(report.onlineNodes).toBe(3);
      expect(report.isByzantineQuorumMaintained).toBe(true);
    });

    it('detects loss of quorum when 2 nodes are partitioned (2/4 online <= 66.7%)', () => {
      const degradedNodes = [...mockNodes];
      degradedNodes[2] = { ...degradedNodes[2], status: 'PARTITIONED' };
      degradedNodes[3] = { ...degradedNodes[3], status: 'PARTITIONED' };

      const report = PlanetarySwarmV3Coordinator.evaluateByzantineQuorum(degradedNodes);
      expect(report.onlineNodes).toBe(2);
      expect(report.isByzantineQuorumMaintained).toBe(false);
    });
  });

  describe('2. Agentic Spot Compute Auctions', () => {
    it('matches bid with lowest-latency online seller node', () => {
      const bid: SpotBidRequest = {
        buyerAgentDid: 'did:sophia:zk:buyer123',
        resourceType: 'GPU_H100_HR',
        maxPriceMicros: 2_500_000, // $2.50/hr max
        unitsRequested: 4,
        durationSeconds: 3600,
        signatureEd25519: 'sig_valid_123',
      };

      const match = PlanetarySwarmV3Coordinator.matchSpotComputeAuction(mockNodes, bid);
      expect(match.status).toBe('SETTLED');
      expect(match.sellerNodeId).toBe('node_iad_1'); // 6ms lowest latency
      expect(match.unitsAllocated).toBe(4);
      expect(match.totalCostUsdCents).toBeGreaterThan(0);
      expect(match.bidProofHash).toHaveLength(64);
    });

    it('rejects auction match when no nodes are online', () => {
      const bid: SpotBidRequest = {
        buyerAgentDid: 'did:sophia:zk:buyer123',
        resourceType: 'GPU_H100_HR',
        maxPriceMicros: 2_500_000,
        unitsRequested: 1,
        durationSeconds: 3600,
        signatureEd25519: 'sig',
      };

      const match = PlanetarySwarmV3Coordinator.matchSpotComputeAuction([], bid);
      expect(match.status).toBe('DISPUTED');
    });
  });

  describe('3. Partition Auto-Healing', () => {
    it('restores partitioned nodes to online state with sub-10ms heartbeats', () => {
      const partitioned: PlanetarySwarmNode[] = [
        { ...mockNodes[0], status: 'PARTITIONED', heartbeatLatencyMs: 450 },
      ];

      const healed = PlanetarySwarmV3Coordinator.healPartitionedNodes(partitioned);
      expect(healed[0].status).toBe('ONLINE');
      expect(healed[0].heartbeatLatencyMs).toBeLessThanOrEqual(10);
    });
  });

  describe('4. D1 Persistence', () => {
    it('persists and retrieves nodes from D1', async () => {
      await PlanetarySwarmV3Coordinator.persistNode(db, mockNodes[0]);
      const all = await PlanetarySwarmV3Coordinator.getAllNodes(db);
      expect(all).toHaveLength(1);
      expect(all[0].nodeKey).toBe('key_iad_1');
    });
  });
});
