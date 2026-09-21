/**
 * @module forest/jobs/__tests__/edge-node-monitor.test
 *
 * Integration test suite for Mekong edge node Inngest health sweep monitor.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  runEdgeNodeHealthSweep,
  edgeNodeHealthSweepCron,
} from '../edge-node-monitor';

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
  } as unknown as D1Database;
}

describe('forest/jobs/edge-node-monitor', () => {
  let db: D1Database;
  const now = 1700000000000;

  beforeEach(() => {
    db = createMockD1Database();
  });

  describe('runEdgeNodeHealthSweep', () => {
    it('executes health sweep and returns cluster health report', async () => {
      // 1. Insert healthy node (stale by 5s)
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_healthy', 'Healthy Node', 'https://h.cashclaw.cc', 'tok_h', 'ONLINE', 'apple_m1_max', 'unmetered', now - 5000, now)
        .run();

      // 2. Insert stale node (stale by 25s)
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_dead', 'Dead Node', 'https://d.cashclaw.cc', 'tok_d', 'ONLINE', 'apple_m1_max', 'unmetered', now - 25000, now)
        .run();

      const report = await runEdgeNodeHealthSweep(db, now, 15);
      expect(report.totalNodes).toBe(2);
      expect(report.onlineCount).toBe(1);
      expect(report.offlineCount).toBe(1);
      expect(report.transitionsToOffline).toContain('node_dead');
      expect(report.transitionsToOffline).not.toContain('node_healthy');

      // Verify node_dead updated to OFFLINE in D1
      const staleRow = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_dead').first<{ status: string }>();
      expect(staleRow?.status).toBe('OFFLINE');
    });
  });

  describe('edgeNodeHealthSweepCron Inngest Function Definition', () => {
    it('is properly registered as an Inngest cron function', () => {
      const fnId = (edgeNodeHealthSweepCron as { id?: () => string; name?: string }).id?.() ?? edgeNodeHealthSweepCron.name;
      expect(fnId).toBeDefined();
    });
  });
});
