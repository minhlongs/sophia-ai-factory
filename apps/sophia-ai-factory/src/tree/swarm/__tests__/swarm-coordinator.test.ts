/** @vitest-environment node */

/**
 * Unit Test Suite: Autonomous Swarm Coordinator Engine
 *
 * Validates:
 * 1. Node registration, upsert semantics, capability advertising
 * 2. Heartbeat telemetry ingestion, load tracking, and degradation states
 * 3. Heartbeat timeout pruning of stale nodes
 * 4. Deterministic consensus leader election (fitness scoring & alphabetical tie-breaking)
 * 5. Least-loaded task dispatch with preferred-region routing & global fallback
 * 6. Cluster topology aggregation and regional breakdown
 *
 * @module tree/swarm/__tests__/swarm-coordinator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  registerSwarmNode,
  getSwarmNodeById,
  listSwarmNodes,
  recordNodeHeartbeat,
  pruneDeadNodes,
  electLeaderFromCandidates,
  electLeaderCoordinator,
  dispatchSwarmTask,
  getSwarmClusterTopology,
  computeCoordinatorFitness,
} from '../swarm-coordinator';
import type { SwarmNode } from '@/seed/types/autonomous-swarm';

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

describe('Autonomous Swarm Coordinator Engine — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS autonomous_swarm_nodes (
        id TEXT PRIMARY KEY,
        node_name TEXT NOT NULL,
        region TEXT NOT NULL CHECK(region IN ('apac', 'us', 'eu', 'global')),
        role TEXT NOT NULL CHECK(role IN ('sales_qualifier', 'retention_flywheel', 'edge_healer', 'coordinator', 'general_worker')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'degraded', 'isolated', 'draining', 'offline')),
        endpoint_url TEXT,
        last_heartbeat_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        cpu_load_pct REAL NOT NULL DEFAULT 0.0 CHECK(cpu_load_pct >= 0.0 AND cpu_load_pct <= 100.0),
        memory_load_pct REAL NOT NULL DEFAULT 0.0 CHECK(memory_load_pct >= 0.0 AND memory_load_pct <= 100.0),
        active_tasks INTEGER NOT NULL DEFAULT 0 CHECK(active_tasks >= 0),
        max_concurrency INTEGER NOT NULL DEFAULT 50 CHECK(max_concurrency > 0),
        is_healthy INTEGER NOT NULL DEFAULT 1 CHECK(is_healthy IN (0, 1)),
        capabilities_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        registered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('Node Registration & Queries', () => {
    it('registers a new swarm node with capabilities and defaults', async () => {
      const node = await registerSwarmNode(db, {
        id: 'node_apac_test_01',
        nodeName: 'APAC Test Coordinator',
        region: 'apac',
        role: 'coordinator',
        endpointUrl: 'https://apac-coord.sophia.network',
        maxConcurrency: 100,
        capabilities: ['leader_election', 'dispatch'],
      });

      expect(node.id).toBe('node_apac_test_01');
      expect(node.nodeName).toBe('APAC Test Coordinator');
      expect(node.region).toBe('apac');
      expect(node.role).toBe('coordinator');
      expect(node.status).toBe('active');
      expect(node.isHealthy).toBe(true);
      expect(node.maxConcurrency).toBe(100);
      expect(node.capabilities).toEqual(['leader_election', 'dispatch']);

      const fetched = await getSwarmNodeById(db, 'node_apac_test_01');
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe('node_apac_test_01');
    });

    it('updates existing node configuration on conflict without resetting state', async () => {
      await registerSwarmNode(db, {
        id: 'node_us_sales_01',
        nodeName: 'US Sales Bot V1',
        region: 'us',
        role: 'sales_qualifier',
        maxConcurrency: 20,
      });

      const updated = await registerSwarmNode(db, {
        id: 'node_us_sales_01',
        nodeName: 'US Sales Bot V2 Upgraded',
        region: 'us',
        role: 'sales_qualifier',
        maxConcurrency: 80,
        capabilities: ['bant_scoring_v2'],
      });

      expect(updated.nodeName).toBe('US Sales Bot V2 Upgraded');
      expect(updated.maxConcurrency).toBe(80);
      expect(updated.capabilities).toContain('bant_scoring_v2');
    });

    it('filters nodes by role, region, and status', async () => {
      await registerSwarmNode(db, {
        id: 'node_1',
        nodeName: 'APAC Sales',
        region: 'apac',
        role: 'sales_qualifier',
      });
      await registerSwarmNode(db, {
        id: 'node_2',
        nodeName: 'US Sales',
        region: 'us',
        role: 'sales_qualifier',
      });
      await registerSwarmNode(db, {
        id: 'node_3',
        nodeName: 'APAC Coordinator',
        region: 'apac',
        role: 'coordinator',
      });

      const apacSales = await listSwarmNodes(db, { region: 'apac', role: 'sales_qualifier' });
      expect(apacSales).toHaveLength(1);
      expect(apacSales[0].id).toBe('node_1');

      const allSales = await listSwarmNodes(db, { role: 'sales_qualifier' });
      expect(allSales).toHaveLength(2);
    });
  });

  describe('Heartbeat Telemetry & Degradation', () => {
    it('records telemetry and updates CPU, memory, and task load', async () => {
      await registerSwarmNode(db, {
        id: 'node_telemetry_01',
        nodeName: 'Telemetry Node',
        region: 'eu',
        role: 'edge_healer',
      });

      const res = await recordNodeHeartbeat(db, {
        nodeId: 'node_telemetry_01',
        cpuLoadPct: 45.5,
        memoryLoadPct: 62.0,
        activeTasks: 12,
        isHealthy: true,
      });

      expect(res.success).toBe(true);

      const node = await getSwarmNodeById(db, 'node_telemetry_01');
      expect(node?.cpuLoadPct).toBe(45.5);
      expect(node?.memoryLoadPct).toBe(62.0);
      expect(node?.activeTasks).toBe(12);
      expect(node?.status).toBe('active');
      expect(node?.isHealthy).toBe(true);
    });

    it('marks node as degraded when isHealthy is false', async () => {
      await registerSwarmNode(db, {
        id: 'node_degraded_01',
        nodeName: 'Degraded Node',
        region: 'us',
        role: 'retention_flywheel',
      });

      await recordNodeHeartbeat(db, {
        nodeId: 'node_degraded_01',
        cpuLoadPct: 98.0,
        memoryLoadPct: 99.0,
        activeTasks: 50,
        isHealthy: false,
      });

      const node = await getSwarmNodeById(db, 'node_degraded_01');
      expect(node?.status).toBe('degraded');
      expect(node?.isHealthy).toBe(false);
    });
  });

  describe('Dead Node Pruning', () => {
    it('prunes nodes whose last heartbeat exceeds timeout threshold', async () => {
      const now = Date.now();
      const oldTime = now - 120_000; // 2 minutes ago

      await registerSwarmNode(db, {
        id: 'node_alive',
        nodeName: 'Alive Node',
        region: 'apac',
        role: 'coordinator',
      });

      await registerSwarmNode(db, {
        id: 'node_dead',
        nodeName: 'Dead Node',
        region: 'apac',
        role: 'coordinator',
      });

      // Manually backdate the dead node's heartbeat
      rawDb.exec(`UPDATE autonomous_swarm_nodes SET last_heartbeat_at = ${oldTime} WHERE id = 'node_dead'`);

      const pruneResult = await pruneDeadNodes(db, 60_000);
      expect(pruneResult.prunedCount).toBe(1);
      expect(pruneResult.nodeIds).toEqual(['node_dead']);

      const deadNode = await getSwarmNodeById(db, 'node_dead');
      expect(deadNode?.status).toBe('offline');
      expect(deadNode?.isHealthy).toBe(false);

      const aliveNode = await getSwarmNodeById(db, 'node_alive');
      expect(aliveNode?.status).toBe('active');
    });
  });

  describe('Consensus Leader Election', () => {
    it('elects coordinator with highest fitness score', () => {
      const now = Date.now();
      const nodeA: SwarmNode = {
        id: 'node_a',
        nodeName: 'Coord A',
        region: 'apac',
        role: 'coordinator',
        status: 'active',
        endpointUrl: null,
        lastHeartbeatAt: now,
        cpuLoadPct: 60.0,
        memoryLoadPct: 50.0,
        activeTasks: 5,
        maxConcurrency: 100,
        isHealthy: true,
        capabilities: [],
        metadata: {},
        registeredAt: now - 10000,
        updatedAt: now,
      };

      const nodeB: SwarmNode = {
        id: 'node_b',
        nodeName: 'Coord B',
        region: 'us',
        role: 'coordinator',
        status: 'active',
        endpointUrl: null,
        lastHeartbeatAt: now,
        cpuLoadPct: 10.0, // Much lower CPU & memory load
        memoryLoadPct: 20.0,
        activeTasks: 1,
        maxConcurrency: 100,
        isHealthy: true,
        capabilities: [],
        metadata: {},
        registeredAt: now - 10000,
        updatedAt: now,
      };

      const leader = electLeaderFromCandidates([nodeA, nodeB], now);
      expect(leader?.id).toBe('node_b');
      expect(computeCoordinatorFitness(nodeB, now)).toBeGreaterThan(computeCoordinatorFitness(nodeA, now));
    });

    it('breaks ties deterministically by node ID when fitness is equal', () => {
      const now = Date.now();
      const nodeX: SwarmNode = {
        id: 'node_x',
        nodeName: 'Coord X',
        region: 'apac',
        role: 'coordinator',
        status: 'active',
        endpointUrl: null,
        lastHeartbeatAt: now,
        cpuLoadPct: 20.0,
        memoryLoadPct: 20.0,
        activeTasks: 0,
        maxConcurrency: 50,
        isHealthy: true,
        capabilities: [],
        metadata: {},
        registeredAt: now - 5000,
        updatedAt: now,
      };

      const nodeY: SwarmNode = {
        ...nodeX,
        id: 'node_y',
        nodeName: 'Coord Y',
      };

      const leader = electLeaderFromCandidates([nodeY, nodeX], now);
      expect(leader?.id).toBe('node_x'); // Alphabetical precedence
    });

    it('disqualifies offline or non-coordinator nodes from election', async () => {
      await registerSwarmNode(db, {
        id: 'sales_node',
        nodeName: 'Sales Bot',
        region: 'apac',
        role: 'sales_qualifier',
      });
      await registerSwarmNode(db, {
        id: 'coord_active',
        nodeName: 'Active Coord',
        region: 'apac',
        role: 'coordinator',
      });

      const leader = await electLeaderCoordinator(db);
      expect(leader?.id).toBe('coord_active');
    });
  });

  describe('Task Dispatching', () => {
    it('dispatches task to least-loaded node in preferred region', async () => {
      await registerSwarmNode(db, {
        id: 'node_apac_busy',
        nodeName: 'APAC Busy',
        region: 'apac',
        role: 'sales_qualifier',
        maxConcurrency: 10,
      });
      await registerSwarmNode(db, {
        id: 'node_apac_idle',
        nodeName: 'APAC Idle',
        region: 'apac',
        role: 'sales_qualifier',
        maxConcurrency: 50,
      });

      // Simulate load on busy node
      rawDb.exec(`UPDATE autonomous_swarm_nodes SET active_tasks = 8 WHERE id = 'node_apac_busy'`);

      const assignment = await dispatchSwarmTask(db, {
        taskType: 'lead_qualification',
        requiredRole: 'sales_qualifier',
        preferredRegion: 'apac',
        payload: { leadId: 'lead_123' },
      });

      expect(assignment.status).toBe('dispatched');
      expect(assignment.assignedNodeId).toBe('node_apac_idle');

      // Verify active task count was incremented
      const idleNode = await getSwarmNodeById(db, 'node_apac_idle');
      expect(idleNode?.activeTasks).toBe(1);
    });

    it('falls back to alternate region when preferred region is saturated', async () => {
      await registerSwarmNode(db, {
        id: 'node_apac_full',
        nodeName: 'APAC Full',
        region: 'apac',
        role: 'sales_qualifier',
        maxConcurrency: 5,
      });
      await registerSwarmNode(db, {
        id: 'node_us_available',
        nodeName: 'US Available',
        region: 'us',
        role: 'sales_qualifier',
        maxConcurrency: 20,
      });

      // Saturate APAC node
      rawDb.exec(`UPDATE autonomous_swarm_nodes SET active_tasks = 5 WHERE id = 'node_apac_full'`);

      const assignment = await dispatchSwarmTask(db, {
        taskType: 'lead_qualification',
        requiredRole: 'sales_qualifier',
        preferredRegion: 'apac',
        payload: { leadId: 'lead_456' },
      });

      expect(assignment.status).toBe('dispatched');
      expect(assignment.assignedNodeId).toBe('node_us_available');
    });

    it('returns rejected_overload when all nodes are at maximum capacity', async () => {
      await registerSwarmNode(db, {
        id: 'node_full',
        nodeName: 'Node Full',
        region: 'apac',
        role: 'edge_healer',
        maxConcurrency: 2,
      });
      rawDb.exec(`UPDATE autonomous_swarm_nodes SET active_tasks = 2 WHERE id = 'node_full'`);

      const assignment = await dispatchSwarmTask(db, {
        taskType: 'edge_healing_action',
        requiredRole: 'edge_healer',
        payload: {},
      });

      expect(assignment.status).toBe('rejected_overload');
      expect(assignment.assignedNodeId).toBe('');
    });
  });

  describe('Cluster Topology Aggregation', () => {
    it('aggregates total counts, health states, and regional distribution accurately', async () => {
      await registerSwarmNode(db, {
        id: 'node_1',
        nodeName: 'APAC Coord',
        region: 'apac',
        role: 'coordinator',
      });
      await registerSwarmNode(db, {
        id: 'node_2',
        nodeName: 'US Healer',
        region: 'us',
        role: 'edge_healer',
      });
      await registerSwarmNode(db, {
        id: 'node_3',
        nodeName: 'EU Healer Degraded',
        region: 'eu',
        role: 'edge_healer',
      });

      rawDb.exec(`UPDATE autonomous_swarm_nodes SET status = 'degraded' WHERE id = 'node_3'`);

      const topology = await getSwarmClusterTopology(db);

      expect(topology.totalNodes).toBe(3);
      expect(topology.activeNodesCount).toBe(2);
      expect(topology.degradedNodesCount).toBe(1);
      expect(topology.coordinatorNodeId).toBe('node_1');
      expect(topology.regionalDistribution.apac).toBe(1);
      expect(topology.regionalDistribution.us).toBe(1);
      expect(topology.regionalDistribution.eu).toBe(1);
    });
  });
});
