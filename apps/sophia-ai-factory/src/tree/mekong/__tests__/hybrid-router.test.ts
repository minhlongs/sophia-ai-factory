/**
 * @module tree/mekong/__tests__/hybrid-router.test
 *
 * Comprehensive unit test suite for Mekong AI Hybrid Task Router & Transparent Cloud Fallback.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { routeInferenceTask } from '../hybrid-router';
import type { InferenceTask } from '../types';

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

describe('tree/mekong/hybrid-router', () => {
  let db: D1Database;
  const now = 1700000000000;

  const baseTask: InferenceTask = {
    taskId: 'task_hybrid_001',
    type: 'llm',
    prompt: 'Synthesize viral marketing campaigns for TikTok',
    model: 'qwen3:32b',
    maxTokens: 512,
  };

  beforeEach(async () => {
    db = createMockD1Database();
  });

  describe('Local Zero-Cost GPU Routing', () => {
    it('routes to active online node with unmetered cost kind', async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_apple_m1', 'Studio M1 Max', 'https://m1.cashclaw.cc', 'tok_secret', 'ONLINE', 'apple_m1_max', 'unmetered', now - 2000, now)
        .run();

      const result = await routeInferenceTask(baseTask, db, undefined, now);
      expect(result.taskId).toBe(baseTask.taskId);
      expect(result.provider).toBe('mekong_m1_max');
      expect(result.costKind).toBe('unmetered');
      expect(result.encrypted).toBe(true);
      expect(result.fallbackTriggered).toBe(false);
      expect(result.edgeNodeId).toBe('node_apple_m1');
      expect(result.output).toContain('[Mekong Local Edge]');
    });

    it('routes to explicit preferredNodeId when provided', async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_m1_preferred', 'Preferred Studio', 'https://pref.cashclaw.cc', 'tok_pref', 'ONLINE', 'apple_m1_max', 'unmetered', now - 1000, now)
        .run();

      const result = await routeInferenceTask(baseTask, db, 'node_m1_preferred', now);
      expect(result.provider).toBe('mekong_m1_max');
      expect(result.edgeNodeId).toBe('node_m1_preferred');
      expect(result.costKind).toBe('unmetered');
    });

    it('supports polymorphic signature (preferredNodeId as arg2, db as arg3)', async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_m1_poly', 'Poly Node', 'https://poly.cashclaw.cc', 'tok_poly', 'ONLINE', 'apple_m1_max', 'unmetered', now - 500, now)
        .run();

      const result = await routeInferenceTask(baseTask, 'node_m1_poly', db, now);
      expect(result.provider).toBe('mekong_m1_max');
      expect(result.edgeNodeId).toBe('node_m1_poly');
      expect(result.costKind).toBe('unmetered');
    });
  });

  describe('Transparent Cloud BYOK Fallback', () => {
    it('falls back to cloud BYOK when database is empty (NO_ONLINE_NODE)', async () => {
      const result = await routeInferenceTask(baseTask, db, undefined, now);
      expect(result.provider).toBe('cloud_byok');
      expect(result.costKind).toBe('metered');
      expect(result.fallbackTriggered).toBe(true);
      expect(result.fallbackReason).toBe('NO_ONLINE_NODE');
      expect(result.output).toContain('[Cloud BYOK Fallback]');
    });

    it('falls back to cloud BYOK when db is undefined', async () => {
      const result = await routeInferenceTask(baseTask, undefined, undefined, now);
      expect(result.provider).toBe('cloud_byok');
      expect(result.costKind).toBe('metered');
      expect(result.fallbackReason).toBe('NO_ONLINE_NODE');
    });

    it('falls back to cloud BYOK when preferred node is not found', async () => {
      const result = await routeInferenceTask(baseTask, db, 'non_existent_node_id', now);
      expect(result.provider).toBe('cloud_byok');
      expect(result.costKind).toBe('metered');
      expect(result.fallbackTriggered).toBe(true);
      expect(result.fallbackReason).toBe('PREFERRED_NODE_NOT_FOUND');
    });

    it('falls back to cloud BYOK when node status is OFFLINE', async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_offline_1', 'Offline Node', 'https://off.cashclaw.cc', 'tok', 'OFFLINE', 'apple_m1_max', 'unmetered', now - 2000, now)
        .run();

      const result = await routeInferenceTask(baseTask, db, 'node_offline_1', now);
      expect(result.provider).toBe('cloud_byok');
      expect(result.costKind).toBe('metered');
      expect(result.fallbackReason).toBe('NODE_OFFLINE');
    });

    it('falls back to cloud BYOK when task specifies bypassEdge: true', async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_m1', 'Online Node', 'https://m1.cashclaw.cc', 'tok', 'ONLINE', 'apple_m1_max', 'unmetered', now - 1000, now)
        .run();

      const bypassTask: InferenceTask = {
        ...baseTask,
        options: { bypassEdge: true },
      };

      const result = await routeInferenceTask(bypassTask, db, 'node_m1', now);
      expect(result.provider).toBe('cloud_byok');
      expect(result.costKind).toBe('metered');
      expect(result.fallbackReason).toBe('BYPASS_REQUESTED');
    });

    it('strictly enforces 15-second heartbeat staleness boundary: 15000ms stays ONLINE, 15001ms falls back', async () => {
      // Exactly 15,000ms stale: still ONLINE
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_fresh_15000', 'Edge 15s', 'https://e1.cashclaw.cc', 't1', 'ONLINE', 'apple_m1_max', 'unmetered', now - 15000, now)
        .run();

      const result1 = await routeInferenceTask(baseTask, db, 'node_fresh_15000', now);
      expect(result1.provider).toBe('mekong_m1_max');
      expect(result1.costKind).toBe('unmetered');

      // 15,001ms stale: falls back to cloud and lazily updates node status to OFFLINE
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_stale_15001', 'Edge 15.001s', 'https://e2.cashclaw.cc', 't2', 'ONLINE', 'apple_m1_max', 'unmetered', now - 15001, now)
        .run();

      const result2 = await routeInferenceTask(baseTask, db, 'node_stale_15001', now);
      expect(result2.provider).toBe('cloud_byok');
      expect(result2.costKind).toBe('metered');
      expect(result2.fallbackReason).toBe('STALE_HEARTBEAT');

      // Verify lazy D1 transition to OFFLINE
      const updatedRow = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_stale_15001').first<{ status: string }>();
      expect(updatedRow?.status).toBe('OFFLINE');
    });

    it('falls back to cloud BYOK when probe fails on unreachable tunnel URL', async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_unreachable', 'Unreachable Node', 'https://unreachable.cashclaw.cc', 'tok', 'ONLINE', 'apple_m1_max', 'unmetered', now - 2000, now)
        .run();

      const result = await routeInferenceTask(baseTask, db, 'node_unreachable', now);
      expect(result.provider).toBe('cloud_byok');
      expect(result.costKind).toBe('metered');
      expect(result.fallbackReason).toBe('PROBE_FAILED');
    });

    it('handles multiple task types (llm, tts, video)', async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_multi', 'Multi Node', 'https://multi.cashclaw.cc', 'tok', 'ONLINE', 'apple_m1_max', 'unmetered', now - 1000, now)
        .run();

      const ttsTask: InferenceTask = { ...baseTask, taskId: 'task_tts_1', type: 'tts' };
      const resTts = await routeInferenceTask(ttsTask, db, 'node_multi', now);
      expect(resTts.provider).toBe('mekong_m1_max');
      expect(resTts.costKind).toBe('unmetered');

      const videoTask: InferenceTask = { ...baseTask, taskId: 'task_vid_1', type: 'video' };
      const resVid = await routeInferenceTask(videoTask, db, 'node_multi', now);
      expect(resVid.provider).toBe('mekong_m1_max');
      expect(resVid.costKind).toBe('unmetered');
    });
  });
});
