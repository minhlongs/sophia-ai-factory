/** @vitest-environment node */

/**
 * Unit Test Suite: Edge Self-Healing Arbiter & Autonomous Circuit Breaker
 *
 * Validates:
 * 1. 3-state finite circuit breaker transitions (CLOSED, OPEN, HALF_OPEN)
 * 2. Consecutive failure trip threshold and cooldown recovery window
 * 3. Dynamic failover target resolution across Anycast regions
 * 4. Degraded node quarantine & isolation with failover handover
 * 5. Autonomous self-healing sweep across all edge nodes
 * 6. Edge healing incident audit logging and resolution tracking
 *
 * @module tree/swarm/__tests__/self-healing-arbiter.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  getCircuitBreakerMetrics,
  recordSuccess,
  recordFailure,
  resetCircuit,
  resetAllCircuits,
  findOptimalFailoverNode,
  isolateNode,
  runSelfHealingSweep,
  logHealingIncident,
  resolveHealingIncident,
  queryHealingIncidents,
} from '../self-healing-arbiter';
import { registerSwarmNode, getSwarmNodeById } from '../swarm-coordinator';

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

describe('Edge Self-Healing Arbiter — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  beforeEach(() => {
    resetAllCircuits();
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

      CREATE TABLE IF NOT EXISTS edge_healing_incidents (
        id TEXT PRIMARY KEY,
        incident_code TEXT NOT NULL UNIQUE,
        node_id TEXT NOT NULL,
        target_region TEXT NOT NULL,
        healing_action TEXT NOT NULL,
        trigger_reason TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        previous_state TEXT NOT NULL,
        remediated_state TEXT NOT NULL,
        failover_target_node_id TEXT,
        execution_duration_ms INTEGER NOT NULL DEFAULT 0,
        automated_recovery INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'executed',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        recovered_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('3-State Circuit Breaker Finite State Machine', () => {
    const customConfig = {
      failureThreshold: 3,
      cooldownPeriodMs: 1000, // 1 second for fast test execution
      probeSuccessThreshold: 1,
    };

    it('initializes in CLOSED state with 0 failures', () => {
      const metrics = getCircuitBreakerMetrics('node_test_cb', customConfig);
      expect(metrics.state).toBe('CLOSED');
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.totalCalls).toBe(0);
    });

    it('stays CLOSED on single/double failures below threshold', () => {
      const res1 = recordFailure('node_test_cb', customConfig);
      expect(res1.tripped).toBe(false);
      expect(res1.metrics.state).toBe('CLOSED');
      expect(res1.metrics.consecutiveFailures).toBe(1);

      const res2 = recordFailure('node_test_cb', customConfig);
      expect(res2.tripped).toBe(false);
      expect(res2.metrics.state).toBe('CLOSED');
      expect(res2.metrics.consecutiveFailures).toBe(2);
    });

    it('trips CLOSED -> OPEN when failure threshold is reached', () => {
      recordFailure('node_test_cb', customConfig);
      recordFailure('node_test_cb', customConfig);
      const res3 = recordFailure('node_test_cb', customConfig);

      expect(res3.tripped).toBe(true);
      expect(res3.metrics.state).toBe('OPEN');
      expect(res3.metrics.consecutiveFailures).toBe(3);
    });

    it('transitions OPEN -> HALF_OPEN after cooldown period elapses', () => {
      const startTime = Date.now();
      recordFailure('node_test_cb', customConfig, startTime);
      recordFailure('node_test_cb', customConfig, startTime);
      recordFailure('node_test_cb', customConfig, startTime);

      // Immediately after trip: still OPEN
      const immediately = getCircuitBreakerMetrics('node_test_cb', customConfig, startTime + 100);
      expect(immediately.state).toBe('OPEN');

      // After cooldown (1001ms later): transitions to HALF_OPEN
      const afterCooldown = getCircuitBreakerMetrics('node_test_cb', customConfig, startTime + 1001);
      expect(afterCooldown.state).toBe('HALF_OPEN');
    });

    it('recovers HALF_OPEN -> CLOSED on successful probe', () => {
      const startTime = Date.now();
      recordFailure('node_test_cb', customConfig, startTime);
      recordFailure('node_test_cb', customConfig, startTime);
      recordFailure('node_test_cb', customConfig, startTime);

      // Force into HALF_OPEN
      getCircuitBreakerMetrics('node_test_cb', customConfig, startTime + 1001);

      // Record success
      const recovered = recordSuccess('node_test_cb', customConfig, startTime + 1002);
      expect(recovered.state).toBe('CLOSED');
      expect(recovered.consecutiveFailures).toBe(0);
    });

    it('trips HALF_OPEN immediately back to OPEN on probe failure', () => {
      const startTime = Date.now();
      recordFailure('node_test_cb', customConfig, startTime);
      recordFailure('node_test_cb', customConfig, startTime);
      recordFailure('node_test_cb', customConfig, startTime);

      // Advance to HALF_OPEN
      getCircuitBreakerMetrics('node_test_cb', customConfig, startTime + 1001);

      // Probe failure
      const probeFailed = recordFailure('node_test_cb', customConfig, startTime + 1002);
      expect(probeFailed.tripped).toBe(true);
      expect(probeFailed.metrics.state).toBe('OPEN');
    });
  });

  describe('Dynamic Failover Rerouting', () => {
    it('selects lowest-load healthy node in preferred fallback region', async () => {
      const failingNode = await registerSwarmNode(db, {
        id: 'node_failing_apac',
        nodeName: 'Failing APAC Node',
        region: 'apac',
        role: 'edge_healer',
      });

      // Register candidate nodes
      await registerSwarmNode(db, {
        id: 'node_us_healthy',
        nodeName: 'US Healthy',
        region: 'us',
        role: 'edge_healer',
      });
      await registerSwarmNode(db, {
        id: 'node_eu_healthy',
        nodeName: 'EU Healthy',
        region: 'eu',
        role: 'edge_healer',
      });

      const failover = await findOptimalFailoverNode(db, failingNode);
      expect(failover).not.toBeNull();
      expect(failover?.id).toBe('node_us_healthy'); // 'us' is first priority for APAC fallback
    });
  });

  describe('Degraded Node Isolation & Quarantine', () => {
    it('quarantines degraded node, trips circuit breaker, and logs incident', async () => {
      await registerSwarmNode(db, {
        id: 'node_erratic',
        nodeName: 'Erratic Node',
        region: 'apac',
        role: 'sales_qualifier',
      });
      await registerSwarmNode(db, {
        id: 'node_standby',
        nodeName: 'Standby Sales',
        region: 'us',
        role: 'sales_qualifier',
      });

      const incident = await isolateNode(db, 'node_erratic', 'High HTTP 504 gateway timeout spike');

      expect(incident.healingAction).toBe('degraded_node_isolation');
      expect(incident.severity).toBe('high');
      expect(incident.previousState).toBe('active');
      expect(incident.remediatedState).toBe('isolated');
      expect(incident.failoverTargetNodeId).toBe('node_standby');

      // Verify node state in DB
      const quarantined = await getSwarmNodeById(db, 'node_erratic');
      expect(quarantined?.status).toBe('isolated');
      expect(quarantined?.isHealthy).toBe(false);

      // Verify circuit breaker was forced OPEN
      const metrics = getCircuitBreakerMetrics('node_erratic');
      expect(metrics.state).toBe('OPEN');
    });
  });

  describe('Autonomous Self-Healing Sweep', () => {
    it('detects OPEN circuits and executes route_reroute incident', async () => {
      await registerSwarmNode(db, {
        id: 'node_tripped',
        nodeName: 'Tripped Node',
        region: 'apac',
        role: 'edge_healer',
      });
      await registerSwarmNode(db, {
        id: 'node_backup',
        nodeName: 'Backup Node',
        region: 'us',
        role: 'edge_healer',
      });

      // Trip the circuit breaker for node_tripped
      const config = { failureThreshold: 1, cooldownPeriodMs: 60000, probeSuccessThreshold: 1 };
      recordFailure('node_tripped', config);

      const sweepResult = await runSelfHealingSweep(db);
      expect(sweepResult.evaluatedNodes).toBe(2);
      expect(sweepResult.incidentsCreated).toBe(1);
      expect(sweepResult.reroutesExecuted).toBe(1);

      const incidents = await queryHealingIncidents(db, { nodeId: 'node_tripped' });
      expect(incidents).toHaveLength(1);
      expect(incidents[0].healingAction).toBe('route_reroute');
      expect(incidents[0].failoverTargetNodeId).toBe('node_backup');
    });

    it('detects resource exhaustion anomalies (>95%) and isolates node', async () => {
      await registerSwarmNode(db, {
        id: 'node_overheated',
        nodeName: 'Overheated Node',
        region: 'eu',
        role: 'retention_flywheel',
      });

      rawDb.exec(`UPDATE autonomous_swarm_nodes SET cpu_load_pct = 98.5 WHERE id = 'node_overheated'`);

      const sweepResult = await runSelfHealingSweep(db);
      expect(sweepResult.incidentsCreated).toBeGreaterThan(0);

      const updated = await getSwarmNodeById(db, 'node_overheated');
      expect(updated?.status).toBe('isolated');
    });
  });

  describe('Incident Resolution & Audit Queries', () => {
    it('resolves healing incident with audit notes and records timestamp', async () => {
      const incident = await logHealingIncident(db, {
        nodeId: 'node_sample',
        targetRegion: 'apac',
        healingAction: 'circuit_breaker_trip',
        triggerReason: '3 consecutive HTTP 500 errors',
        previousState: 'active',
        remediatedState: 'tripped',
      });

      const res = await resolveHealingIncident(db, incident.id, 'Edge daemon restarted and health verified');
      expect(res.success).toBe(true);

      const incidents = await queryHealingIncidents(db, { nodeId: 'node_sample' });
      expect(incidents).toHaveLength(1);
      expect(incidents[0].status).toBe('recovered');
      expect(incidents[0].recoveredAt).not.toBeNull();
      expect(incidents[0].metadata.resolutionNotes).toBe('Edge daemon restarted and health verified');
    });
  });
});
