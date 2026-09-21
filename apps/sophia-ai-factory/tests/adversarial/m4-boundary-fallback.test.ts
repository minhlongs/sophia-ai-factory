/**
 * Adversarial Empirical Challenger Test Suite — Milestone M4: Mekong AI Hybrid Edge Node
 *
 * @vitest-environment node
 *
 * Focus:
 * 1. Mathematical Boundary on 15-Second Offline Transition:
 *    - Strict inequality check: (nowMs - last_heartbeat_at > 15000)
 *    - nowMs - last_heartbeat_at = 15000 (exactly 15s) -> Node status remains ONLINE in D1.
 *    - nowMs - last_heartbeat_at = 15001 (15s + 1ms) -> Node status transitions to OFFLINE in D1.
 *    - Subsequent fresh heartbeat -> Node status recovers to ONLINE and resumes zero-cost routing.
 * 2. Hybrid Router Fallback Decision Matrix (All 6 Triggers):
 *    - NO_ONLINE_NODE (empty registry, all offline, or undefined db)
 *    - PREFERRED_NODE_NOT_FOUND (invalid / nonexistent node ID)
 *    - NODE_OFFLINE (node status explicitly OFFLINE or DEGRADED)
 *    - STALE_HEARTBEAT (heartbeat staleness > 15000ms triggers lazy transition)
 *    - PROBE_FAILED (simulated unreachable / failed tunnel probe)
 *    - TUNNEL_TIMEOUT (network timeout / abort error caught and gracefully mitigated)
 * 3. Economic Honesty Invariant:
 *    - Local GPU execution yields costKind: 'unmetered' ($0.00 marginal cost)
 *    - Cloud fallback yields costKind: 'metered' (commercial cloud billing)
 *    - Multi-modal task diversity (LLM, TTS, video, embedding)
 *
 * Layer: tests/adversarial
 * Zero :any types rule strictly enforced.
 *
 * @module tests/adversarial/m4-boundary-fallback.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  checkClusterHealth,
  processNodeHeartbeat,
  probeEdgeNode,
} from '@/tree/mekong/health';
import {
  routeInferenceTask,
  executeCloudFallback,
  DEFAULT_HEARTBEAT_THRESHOLD_MS,
} from '@/tree/mekong/hybrid-router';
import type {
  InferenceTask,
  InferenceResult,
  FallbackReason,
  EdgeNodeRecord,
  MekongHeartbeatTelemetry,
} from '@/tree/mekong/types';

/**
 * Deterministic In-Memory D1 Mock using Node 22 native DatabaseSync
 */
function createAdversarialMockD1(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS edge_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tunnel_url TEXT NOT NULL,
      bearer_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(status IN ('ONLINE', 'OFFLINE', 'DEGRADED')),
      hardware_profile TEXT NOT NULL DEFAULT 'apple_m1_max',
      cost_kind TEXT NOT NULL DEFAULT 'unmetered',
      last_heartbeat_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS edge_node_heartbeats (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES edge_nodes(id),
      status TEXT NOT NULL,
      latency_ms REAL NOT NULL DEFAULT 10.0,
      recorded_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    batch: async (stmts: unknown[]) => Promise.all(stmts),
  } as unknown as D1Database;
}

describe('Milestone M4 Adversarial: 15-Second Offline Transition Boundary', () => {
  let db: D1Database;
  const baseTimeMs = 1715000000000;

  beforeEach(() => {
    db = createAdversarialMockD1();
  });

  it('verifies exact mathematical boundary: 15000ms stays ONLINE, 15001ms transitions to OFFLINE in checkClusterHealth', async () => {
    // Node A: Exactly 15,000ms stale (delta = 15000ms)
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'node_exact_15000',
        'Node Exact 15s',
        'https://exact15000.cashclaw.cc',
        'token_15000',
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        baseTimeMs - 15000,
        baseTimeMs,
      )
      .run();

    // Node B: Exactly 15,001ms stale (delta = 15001ms)
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'node_stale_15001',
        'Node Stale 15.001s',
        'https://stale15001.cashclaw.cc',
        'token_15001',
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        baseTimeMs - 15001,
        baseTimeMs,
      )
      .run();

    // Node C: 14,999ms stale (delta = 14999ms)
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'node_fresh_14999',
        'Node Fresh 14.999s',
        'https://fresh14999.cashclaw.cc',
        'token_14999',
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        baseTimeMs - 14999,
        baseTimeMs,
      )
      .run();

    const report = await checkClusterHealth(db, baseTimeMs, 15);

    // Assert cluster counts
    expect(report.totalNodes).toBe(3);
    expect(report.onlineCount).toBe(2); // 15000ms and 14999ms remain ONLINE
    expect(report.offlineCount).toBe(1); // 15001ms transitions to OFFLINE
    expect(report.transitionsToOffline).toEqual(['node_stale_15001']);
    expect(report.transitionsToOffline).not.toContain('node_exact_15000');
    expect(report.transitionsToOffline).not.toContain('node_fresh_14999');

    // Verify D1 state persistence
    const d1Node15000 = await db
      .prepare('SELECT status FROM edge_nodes WHERE id = ?')
      .bind('node_exact_15000')
      .first<{ status: string }>();
    expect(d1Node15000?.status).toBe('ONLINE');

    const d1Node15001 = await db
      .prepare('SELECT status FROM edge_nodes WHERE id = ?')
      .bind('node_stale_15001')
      .first<{ status: string }>();
    expect(d1Node15001?.status).toBe('OFFLINE');

    const d1Node14999 = await db
      .prepare('SELECT status FROM edge_nodes WHERE id = ?')
      .bind('node_fresh_14999')
      .first<{ status: string }>();
    expect(d1Node14999?.status).toBe('ONLINE');
  });

  it('verifies exact mathematical boundary in hybrid task router: 15000ms stays ONLINE, 15001ms falls back with lazy D1 transition', async () => {
    const task: InferenceTask = {
      taskId: 'task_boundary_eval',
      type: 'llm',
      prompt: 'Verify mathematical boundary condition',
      model: 'qwen3:32b',
    };

    // Case 1: Node at exactly 15000ms staleness
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'node_router_15000',
        'Node 15s Route',
        'https://router15000.cashclaw.cc',
        'tok_r15000',
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        baseTimeMs - 15000,
        baseTimeMs,
      )
      .run();

    const resultOnline = await routeInferenceTask(task, db, 'node_router_15000', baseTimeMs);
    expect(resultOnline.provider).toBe('mekong_m1_max');
    expect(resultOnline.costKind).toBe('unmetered');
    expect(resultOnline.fallbackTriggered).toBe(false);
    expect(resultOnline.edgeNodeId).toBe('node_router_15000');

    // Case 2: Node at 15001ms staleness
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'node_router_15001',
        'Node 15.001s Route',
        'https://router15001.cashclaw.cc',
        'tok_r15001',
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        baseTimeMs - 15001,
        baseTimeMs,
      )
      .run();

    const resultStale = await routeInferenceTask(task, db, 'node_router_15001', baseTimeMs);
    expect(resultStale.provider).toBe('cloud_byok');
    expect(resultStale.costKind).toBe('metered');
    expect(resultStale.fallbackTriggered).toBe(true);
    expect(resultStale.fallbackReason).toBe('STALE_HEARTBEAT');

    // Verify lazy D1 state update
    const rowStale = await db
      .prepare('SELECT status FROM edge_nodes WHERE id = ?')
      .bind('node_router_15001')
      .first<{ status: string }>();
    expect(rowStale?.status).toBe('OFFLINE');
  });

  it('verifies seamless recovery: node transitioned to OFFLINE recovers to ONLINE upon fresh heartbeat ingestion', async () => {
    const nodeId = 'node_recovery_lifecycle';
    const bearerToken = 'tok_secret_recover';

    // Step 1: Insert node that is 20s stale
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        nodeId,
        'Recovery Node',
        'https://recover.cashclaw.cc',
        bearerToken,
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        baseTimeMs - 20000,
        baseTimeMs,
      )
      .run();

    // Step 2: Trigger transition to OFFLINE via checkClusterHealth
    const healthReport = await checkClusterHealth(db, baseTimeMs, 15);
    expect(healthReport.transitionsToOffline).toContain(nodeId);

    const checkOffline = await db
      .prepare('SELECT status FROM edge_nodes WHERE id = ?')
      .bind(nodeId)
      .first<{ status: string }>();
    expect(checkOffline?.status).toBe('OFFLINE');

    // Step 3: mekongd daemon sends fresh heartbeat 5 seconds later
    const recoveryTimeMs = baseTimeMs + 5000;
    const telemetry: MekongHeartbeatTelemetry = {
      gpuUtilizationPct: 45.2,
      vramUsedBytes: 16 * 1024 * 1024 * 1024,
      vramTotalBytes: 32 * 1024 * 1024 * 1024,
      queueDepth: 1,
      latencyMs: 12.4,
    };

    const ingestion = await processNodeHeartbeat(
      db,
      {
        nodeId,
        bearerToken,
        reportedStatus: 'ONLINE',
        telemetry,
      },
      recoveryTimeMs,
    );

    expect(ingestion.success).toBe(true);
    expect(ingestion.status).toBe('ONLINE');

    // Step 4: Verify D1 node is back to ONLINE
    const checkRecovered = await db
      .prepare('SELECT status, last_heartbeat_at FROM edge_nodes WHERE id = ?')
      .bind(nodeId)
      .first<{ status: string; last_heartbeat_at: number }>();
    expect(checkRecovered?.status).toBe('ONLINE');
    expect(checkRecovered?.last_heartbeat_at).toBe(recoveryTimeMs);

    // Step 5: Verify subsequent cluster health sweep recognizes recovered node as ONLINE
    const reportAfterRecovery = await checkClusterHealth(db, recoveryTimeMs + 2000, 15);
    expect(reportAfterRecovery.onlineCount).toBe(1);
    expect(reportAfterRecovery.offlineCount).toBe(0);
    expect(reportAfterRecovery.transitionsToOffline).toHaveLength(0);

    // Step 6: Verify router now directs traffic to local hardware with costKind: unmetered
    const task: InferenceTask = {
      taskId: 'task_post_recovery',
      type: 'llm',
      prompt: 'Post-recovery verification prompt',
      model: 'qwen3:32b',
    };
    const routeRes = await routeInferenceTask(task, db, nodeId, recoveryTimeMs + 2000);
    expect(routeRes.provider).toBe('mekong_m1_max');
    expect(routeRes.costKind).toBe('unmetered');
    expect(routeRes.fallbackTriggered).toBe(false);
  });

  it('handles negative staleness / clock drift gracefully without marking node OFFLINE', async () => {
    // Node with last_heartbeat_at 5 seconds in the future due to slight clock drift
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'node_clock_skew',
        'Clock Skew Node',
        'https://skew.cashclaw.cc',
        'tok_skew',
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        baseTimeMs + 5000,
        baseTimeMs,
      )
      .run();

    const report = await checkClusterHealth(db, baseTimeMs, 15);
    expect(report.onlineCount).toBe(1);
    expect(report.offlineCount).toBe(0);
    expect(report.transitionsToOffline).not.toContain('node_clock_skew');
  });
});

describe('Milestone M4 Adversarial: Hybrid Router Fallback Decision Matrix', () => {
  let db: D1Database;
  const nowMs = 1715000000000;

  const sampleTask: InferenceTask = {
    taskId: 'task_matrix_001',
    type: 'llm',
    prompt: 'Evaluate fallback decision matrix coverage',
    model: 'qwen3:32b',
    maxTokens: 256,
  };

  beforeEach(() => {
    db = createAdversarialMockD1();
  });

  it('Trigger 1: NO_ONLINE_NODE — falls back cleanly when db is undefined, empty, or all offline', async () => {
    // Sub-case 1A: Undefined database instance
    const resUndefinedDb = await routeInferenceTask(sampleTask, undefined, undefined, nowMs);
    expect(resUndefinedDb.fallbackTriggered).toBe(true);
    expect(resUndefinedDb.fallbackReason).toBe('NO_ONLINE_NODE');
    expect(resUndefinedDb.provider).toBe('cloud_byok');
    expect(resUndefinedDb.costKind).toBe('metered');
    expect(resUndefinedDb.output).toContain('[Cloud BYOK Fallback]');

    // Sub-case 1B: Empty edge_nodes table
    const resEmptyTable = await routeInferenceTask(sampleTask, db, undefined, nowMs);
    expect(resEmptyTable.fallbackTriggered).toBe(true);
    expect(resEmptyTable.fallbackReason).toBe('NO_ONLINE_NODE');
    expect(resEmptyTable.provider).toBe('cloud_byok');
    expect(resEmptyTable.costKind).toBe('metered');

    // Sub-case 1C: Multiple registered nodes, but all are OFFLINE
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_off_a', 'Node Off A', 'https://off-a.cashclaw.cc', 'tok_a', 'OFFLINE', 'apple_m1_max', 'unmetered', nowMs - 1000, nowMs)
      .run();

    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_off_b', 'Node Off B', 'https://off-b.cashclaw.cc', 'tok_b', 'OFFLINE', 'apple_m1_max', 'unmetered', nowMs - 1000, nowMs)
      .run();

    const resAllOffline = await routeInferenceTask(sampleTask, db, undefined, nowMs);
    expect(resAllOffline.fallbackTriggered).toBe(true);
    expect(resAllOffline.fallbackReason).toBe('NO_ONLINE_NODE');
    expect(resAllOffline.provider).toBe('cloud_byok');
    expect(resAllOffline.costKind).toBe('metered');
  });

  it('Trigger 2: PREFERRED_NODE_NOT_FOUND — falls back cleanly when preferredNodeId does not exist', async () => {
    // Populate an unrelated online node
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_real', 'Real Node', 'https://real.cashclaw.cc', 'tok_real', 'ONLINE', 'apple_m1_max', 'unmetered', nowMs - 1000, nowMs)
      .run();

    const res = await routeInferenceTask(sampleTask, db, 'non_existent_preferred_node_guid', nowMs);
    expect(res.fallbackTriggered).toBe(true);
    expect(res.fallbackReason).toBe('PREFERRED_NODE_NOT_FOUND');
    expect(res.provider).toBe('cloud_byok');
    expect(res.costKind).toBe('metered');
    expect(res.output).toContain('[Cloud BYOK Fallback]');
  });

  it('Trigger 3: NODE_OFFLINE — falls back cleanly when preferred node status is OFFLINE or DEGRADED', async () => {
    // Explicit OFFLINE node
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_explicit_offline', 'Explicit Offline', 'https://off.cashclaw.cc', 'tok_off', 'OFFLINE', 'apple_m1_max', 'unmetered', nowMs - 2000, nowMs)
      .run();

    const resOffline = await routeInferenceTask(sampleTask, db, 'node_explicit_offline', nowMs);
    expect(resOffline.fallbackTriggered).toBe(true);
    expect(resOffline.fallbackReason).toBe('NODE_OFFLINE');
    expect(resOffline.provider).toBe('cloud_byok');
    expect(resOffline.costKind).toBe('metered');

    // Explicit DEGRADED node
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_explicit_degraded', 'Explicit Degraded', 'https://deg.cashclaw.cc', 'tok_deg', 'DEGRADED', 'apple_m1_max', 'unmetered', nowMs - 2000, nowMs)
      .run();

    const resDegraded = await routeInferenceTask(sampleTask, db, 'node_explicit_degraded', nowMs);
    expect(resDegraded.fallbackTriggered).toBe(true);
    expect(resDegraded.fallbackReason).toBe('NODE_OFFLINE');
    expect(resDegraded.costKind).toBe('metered');
  });

  it('Trigger 4: STALE_HEARTBEAT — falls back cleanly when heartbeat exceeds 15,000ms threshold', async () => {
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_stale_hb', 'Stale HB Node', 'https://stale.cashclaw.cc', 'tok_stale', 'ONLINE', 'apple_m1_max', 'unmetered', nowMs - 25000, nowMs)
      .run();

    const resStale = await routeInferenceTask(sampleTask, db, 'node_stale_hb', nowMs);
    expect(resStale.fallbackTriggered).toBe(true);
    expect(resStale.fallbackReason).toBe('STALE_HEARTBEAT');
    expect(resStale.provider).toBe('cloud_byok');
    expect(resStale.costKind).toBe('metered');

    // Confirm node state was lazily updated to OFFLINE in D1
    const row = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_stale_hb').first<{ status: string }>();
    expect(row?.status).toBe('OFFLINE');
  });

  it('Trigger 5: PROBE_FAILED — falls back cleanly when edge tunnel probe fails or URL is unreachable', async () => {
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'node_unreachable_tunnel',
        'Unreachable Tunnel',
        'https://edge-unreachable.cashclaw.cc',
        'tok_probe_fail',
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        nowMs - 1000,
        nowMs,
      )
      .run();

    const resProbeFail = await routeInferenceTask(sampleTask, db, 'node_unreachable_tunnel', nowMs);
    expect(resProbeFail.fallbackTriggered).toBe(true);
    expect(resProbeFail.fallbackReason).toBe('PROBE_FAILED');
    expect(resProbeFail.provider).toBe('cloud_byok');
    expect(resProbeFail.costKind).toBe('metered');
    expect(resProbeFail.output).toContain('[Cloud BYOK Fallback]');
  });

  it('Trigger 6: TUNNEL_TIMEOUT — catches tunnel network timeout / abort cleanly and falls back with zero crash', async () => {
    // Construct a mock D1Database whose prepare() throws a timeout error simulating network abort
    const timeoutDb = {
      prepare(_sql: string) {
        throw new Error('Cloudflare tunnel connection timeout after 2500ms (AbortError)');
      },
      exec: async () => ({ count: 0, duration: 0 }),
      batch: async () => [],
    } as unknown as D1Database;

    const resTimeout = await routeInferenceTask(sampleTask, timeoutDb, 'node_timeout_sim', nowMs);
    expect(resTimeout.fallbackTriggered).toBe(true);
    expect(resTimeout.fallbackReason).toBe('TUNNEL_TIMEOUT');
    expect(resTimeout.provider).toBe('cloud_byok');
    expect(resTimeout.costKind).toBe('metered');
    expect(resTimeout.output).toContain('[Cloud BYOK Fallback]');
  });
});

describe('Milestone M4 Adversarial: Economic Honesty & Multi-Task Invariance', () => {
  let db: D1Database;
  const nowMs = 1715000000000;

  beforeEach(async () => {
    db = createAdversarialMockD1();

    // Register active healthy M1 Max node
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'node_m1_max_active',
        'Sophia Studio M1 Max',
        'https://m1-active.cashclaw.cc',
        'tok_m1_active',
        'ONLINE',
        'apple_m1_max',
        'unmetered',
        nowMs - 500,
        nowMs,
      )
      .run();
  });

  it('enforces economic honesty invariant: local edge is strictly unmetered ($0.00), fallback is strictly metered', async () => {
    const task: InferenceTask = {
      taskId: 'task_econ_verify',
      type: 'llm',
      prompt: 'Check economic honesty invariant',
      model: 'qwen3:32b',
    };

    // 1. Healthy edge execution -> unmetered
    const edgeResult = await routeInferenceTask(task, db, 'node_m1_max_active', nowMs);
    expect(edgeResult.costKind).toBe('unmetered');
    expect(edgeResult.provider).toBe('mekong_m1_max');
    expect(edgeResult.fallbackTriggered).toBe(false);

    // 2. Direct fallback call -> metered
    const fallbackResult = executeCloudFallback(task, 'NO_ONLINE_NODE');
    expect(fallbackResult.costKind).toBe('metered');
    expect(fallbackResult.provider).toBe('cloud_byok');
    expect(fallbackResult.fallbackTriggered).toBe(true);

    // Invariant: costKind must never be inverted
    expect(edgeResult.costKind).not.toBe('metered');
    expect(fallbackResult.costKind).not.toBe('unmetered');
  });

  it('preserves multi-modal task types across local execution and cloud fallback', async () => {
    const taskTypes: Array<InferenceTask['type']> = ['llm', 'tts', 'video', 'embedding'];

    for (const type of taskTypes) {
      const task: InferenceTask = {
        taskId: `task_multimodal_${type}`,
        type,
        prompt: `Multimodal generation prompt for ${type}`,
        model: type === 'tts' ? 'chatterbox-tts' : 'qwen3:32b',
      };

      // Local execution
      const localRes = await routeInferenceTask(task, db, 'node_m1_max_active', nowMs);
      expect(localRes.provider).toBe('mekong_m1_max');
      expect(localRes.costKind).toBe('unmetered');
      expect(localRes.fallbackTriggered).toBe(false);
      expect(localRes.output).toBeTruthy();

      // Cloud fallback execution (with bypass)
      const bypassTask: InferenceTask = { ...task, options: { bypassEdge: true } };
      const fallbackRes = await routeInferenceTask(bypassTask, db, 'node_m1_max_active', nowMs);
      expect(fallbackRes.provider).toBe('cloud_byok');
      expect(fallbackRes.costKind).toBe('metered');
      expect(fallbackRes.fallbackTriggered).toBe(true);
      expect(fallbackRes.fallbackReason).toBe('BYPASS_REQUESTED');
      expect(fallbackRes.output).toBeTruthy();
    }
  });

  it('protects hardware under severe resource pressure: VRAM >95% marks node DEGRADED and routes to cloud fallback', async () => {
    const pressureTime = nowMs + 1000;
    const highVramTelemetry: MekongHeartbeatTelemetry = {
      gpuUtilizationPct: 99.0,
      vramUsedBytes: 31.5 * 1024 * 1024 * 1024,
      vramTotalBytes: 32 * 1024 * 1024 * 1024, // ~98.4% saturation
      queueDepth: 12,
      latencyMs: 95.0,
    };

    // Daemon reports high pressure
    const ingestRes = await processNodeHeartbeat(
      db,
      {
        nodeId: 'node_m1_max_active',
        bearerToken: 'tok_m1_active',
        telemetry: highVramTelemetry,
      },
      pressureTime,
    );

    expect(ingestRes.success).toBe(true);
    expect(ingestRes.status).toBe('DEGRADED');

    // D1 status should now be DEGRADED
    const nodeStatus = await db
      .prepare('SELECT status FROM edge_nodes WHERE id = ?')
      .bind('node_m1_max_active')
      .first<{ status: string }>();
    expect(nodeStatus?.status).toBe('DEGRADED');

    // Router should reject DEGRADED node and cleanly fallback to cloud with NODE_OFFLINE
    const task: InferenceTask = {
      taskId: 'task_under_pressure',
      type: 'llm',
      prompt: 'Heavy reasoning workload',
      model: 'qwen3:32b',
    };
    const routeRes = await routeInferenceTask(task, db, 'node_m1_max_active', pressureTime + 100);
    expect(routeRes.fallbackTriggered).toBe(true);
    expect(routeRes.fallbackReason).toBe('NODE_OFFLINE');
    expect(routeRes.costKind).toBe('metered');
    expect(routeRes.provider).toBe('cloud_byok');
  });
});
