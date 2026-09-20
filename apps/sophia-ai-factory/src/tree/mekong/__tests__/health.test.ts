/**
 * @module tree/mekong/__tests__/health.test
 *
 * Comprehensive unit test suite for Mekong health probes, 15-second offline transition
 * detection, and heartbeat telemetry ingestion.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  probeEdgeNode,
  checkClusterHealth,
  processNodeHeartbeat,
} from '../health';
import { encryptPayload } from '../crypto';

function createMockD1Database(): D1Database {
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

describe('tree/mekong/health', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createMockD1Database();
  });

  describe('probeEdgeNode', () => {
    it('fails closed when timeoutMs < 500ms', async () => {
      const probe = await probeEdgeNode('https://edge.cashclaw.cc', 'tok_abc', 400);
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
      expect(probe.error).toBe('INVALID_PROBE_CONFIGURATION');
    });

    it('fails closed on empty URL or empty bearer token', async () => {
      const probe1 = await probeEdgeNode('', 'tok_abc');
      expect(probe1.status).toBe('OFFLINE');
      expect(probe1.reachable).toBe(false);

      const probe2 = await probeEdgeNode('https://edge.cashclaw.cc', '');
      expect(probe2.status).toBe('OFFLINE');
      expect(probe2.reachable).toBe(false);
    });

    it('fails closed on simulated offline or unreachable URL', async () => {
      const probe = await probeEdgeNode('https://edge-unreachable.cashclaw.cc', 'tok_abc', 2000);
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
      expect(probe.latencyMs).toBe(2000);
    });

    it('returns ONLINE with default test latency for valid configuration', async () => {
      const probe = await probeEdgeNode('https://edge.cashclaw.cc', 'tok_abc', 2500);
      expect(probe.status).toBe('ONLINE');
      expect(probe.reachable).toBe(true);
      expect(probe.latencyMs).toBeGreaterThan(0);
    });
  });

  describe('checkClusterHealth (15-Second Boundary Rule)', () => {
    it('returns 0 counts on empty edge_nodes table without error', async () => {
      const report = await checkClusterHealth(db);
      expect(report.totalNodes).toBe(0);
      expect(report.onlineCount).toBe(0);
      expect(report.offlineCount).toBe(0);
      expect(report.transitionsToOffline).toEqual([]);
    });

    it('strictly distinguishes 15000ms stale (remains ONLINE) from 15001ms stale (transitions to OFFLINE)', async () => {
      const now = 1700000050000;

      // Exactly 15,000ms stale: remains ONLINE
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_15000', 'Node 15s', 'https://n1.cashclaw.cc', 't1', 'ONLINE', 'apple_m1_max', 'unmetered', now - 15000, now)
        .run();

      // 15,001ms stale: transitions to OFFLINE
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_15001', 'Node 15.001s', 'https://n2.cashclaw.cc', 't2', 'ONLINE', 'apple_m1_max', 'unmetered', now - 15001, now)
        .run();

      const report = await checkClusterHealth(db, now, 15);
      expect(report.transitionsToOffline).not.toContain('node_15000');
      expect(report.transitionsToOffline).toContain('node_15001');
      expect(report.onlineCount).toBe(1);
      expect(report.offlineCount).toBe(1);

      // Verify D1 state
      const row1 = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_15000').first<{ status: string }>();
      expect(row1?.status).toBe('ONLINE');

      const row2 = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_15001').first<{ status: string }>();
      expect(row2?.status).toBe('OFFLINE');
    });

    it('transitions stale DEGRADED nodes to OFFLINE', async () => {
      const now = 1700000050000;
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_deg_stale', 'Degrading Node', 'https://deg.cashclaw.cc', 't_deg', 'DEGRADED', 'apple_m1_max', 'unmetered', now - 20000, now)
        .run();

      const report = await checkClusterHealth(db, now, 15);
      expect(report.transitionsToOffline).toContain('node_deg_stale');

      const row = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_deg_stale').first<{ status: string }>();
      expect(row?.status).toBe('OFFLINE');
    });

    it('does not re-transition nodes that are already OFFLINE', async () => {
      const now = 1700000050000;
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_already_off', 'Offline Node', 'https://off.cashclaw.cc', 't_off', 'OFFLINE', 'apple_m1_max', 'unmetered', now - 50000, now)
        .run();

      const report = await checkClusterHealth(db, now, 15);
      expect(report.transitionsToOffline).not.toContain('node_already_off');
      expect(report.offlineCount).toBe(1);
    });
  });

  describe('processNodeHeartbeat', () => {
    const now = 1700000100000;

    beforeEach(async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('m1_node_1', 'Apple M1 Max Studio', 'https://m1.cashclaw.cc', 'm1_secret_token', 'ONLINE', 'apple_m1_max', 'unmetered', now - 10000, now)
        .run();
    });

    it('ingests valid heartbeat and updates last_heartbeat_at and heartbeats table', async () => {
      const result = await processNodeHeartbeat(
        db,
        {
          nodeId: 'm1_node_1',
          bearerToken: 'm1_secret_token',
          telemetry: {
            gpuUtilizationPct: 45.5,
            vramUsedBytes: 16 * 1024 * 1024 * 1024,
            vramTotalBytes: 32 * 1024 * 1024 * 1024,
            queueDepth: 2,
            latencyMs: 12.4,
          },
        },
        now,
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('ONLINE');
      expect(result.recordedAt).toBe(now);

      // Verify edge_nodes updated
      const nodeRow = await db.prepare('SELECT status, last_heartbeat_at FROM edge_nodes WHERE id = ?').bind('m1_node_1').first<{ status: string; last_heartbeat_at: number }>();
      expect(nodeRow?.last_heartbeat_at).toBe(now);
      expect(nodeRow?.status).toBe('ONLINE');

      // Verify edge_node_heartbeats row inserted
      const hbRow = await db.prepare('SELECT node_id, status, latency_ms FROM edge_node_heartbeats WHERE node_id = ?').bind('m1_node_1').first<{ node_id: string; status: string; latency_ms: number }>();
      expect(hbRow?.status).toBe('ONLINE');
      expect(hbRow?.latency_ms).toBe(12.4);
    });

    it('marks status DEGRADED when VRAM exceeds 95%', async () => {
      const result = await processNodeHeartbeat(
        db,
        {
          nodeId: 'm1_node_1',
          bearerToken: 'm1_secret_token',
          telemetry: {
            gpuUtilizationPct: 98.0,
            vramUsedBytes: 31.5 * 1024 * 1024 * 1024,
            vramTotalBytes: 32.0 * 1024 * 1024 * 1024, // > 98%
            queueDepth: 1,
            latencyMs: 35.0,
          },
        },
        now,
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('DEGRADED');

      const nodeRow = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('m1_node_1').first<{ status: string }>();
      expect(nodeRow?.status).toBe('DEGRADED');
    });

    it('marks status DEGRADED when queue depth exceeds 10', async () => {
      const result = await processNodeHeartbeat(
        db,
        {
          nodeId: 'm1_node_1',
          bearerToken: 'm1_secret_token',
          telemetry: {
            gpuUtilizationPct: 50.0,
            vramUsedBytes: 10 * 1024 * 1024 * 1024,
            vramTotalBytes: 32 * 1024 * 1024 * 1024,
            queueDepth: 14, // > 10
            latencyMs: 40.0,
          },
        },
        now,
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('DEGRADED');
    });

    it('rejects invalid bearer token', async () => {
      const result = await processNodeHeartbeat(
        db,
        {
          nodeId: 'm1_node_1',
          bearerToken: 'wrong_token',
        },
        now,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_BEARER_TOKEN');
    });

    it('rejects unknown node ID', async () => {
      const result = await processNodeHeartbeat(
        db,
        {
          nodeId: 'non_existent_node',
          bearerToken: 'some_token',
        },
        now,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('NODE_NOT_FOUND');
    });

    it('decrypts AES-256-GCM encrypted telemetry payload', async () => {
      const telemetry = {
        gpuUtilizationPct: 60.0,
        vramUsedBytes: 12 * 1024 * 1024 * 1024,
        vramTotalBytes: 32 * 1024 * 1024 * 1024,
        queueDepth: 1,
        latencyMs: 15.0,
      };

      const encryptedEnvelope = await encryptPayload(telemetry, 'm1_secret_token');

      const result = await processNodeHeartbeat(
        db,
        {
          nodeId: 'm1_node_1',
          bearerToken: 'm1_secret_token',
          encryptedPayload: encryptedEnvelope,
        },
        now,
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('ONLINE');
    });

    it('recovers an OFFLINE node back to ONLINE on subsequent heartbeat receipt', async () => {
      // 1. Manually set node to OFFLINE
      await db.prepare("UPDATE edge_nodes SET status = 'OFFLINE' WHERE id = ?").bind('m1_node_1').run();

      const before = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('m1_node_1').first<{ status: string }>();
      expect(before?.status).toBe('OFFLINE');

      // 2. Receive heartbeat
      const result = await processNodeHeartbeat(
        db,
        {
          nodeId: 'm1_node_1',
          bearerToken: 'm1_secret_token',
          telemetry: {
            gpuUtilizationPct: 20.0,
            vramUsedBytes: 8 * 1024 * 1024 * 1024,
            vramTotalBytes: 32 * 1024 * 1024 * 1024,
            queueDepth: 0,
            latencyMs: 9.0,
          },
        },
        now + 1000,
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('ONLINE');

      const after = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('m1_node_1').first<{ status: string }>();
      expect(after?.status).toBe('ONLINE');
    });
  });
});
