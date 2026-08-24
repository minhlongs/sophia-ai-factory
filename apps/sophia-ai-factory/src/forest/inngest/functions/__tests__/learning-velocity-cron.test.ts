/**
 * Tests for learning-velocity-cron internal helpers.
 *
 * Covers:
 *   1. computeVelocityScore — no data → 50
 *   2. computeVelocityScore — improvement (late > early) → score > 50
 *   3. computeVelocityScore — regression (late < early) → score < 50
 *   4. computeVelocityScore — identical early/late → 50
 *   5. computeVelocity — < 4 events → null
 *   6. computeVelocity — >= 4 events → returns metric with correct fields
 *   7. writeVelocity — inserts a row, SELECT confirms it
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// ── Module mocks (MUST come before imports that depend on them) ─────────────

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_cfg: unknown, _event: unknown, handler: unknown) => handler),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Imports after mocks ─────────────────────────────────────────────────────

import {
  computeVelocityScore,
  avgMetrics,
  computeVelocity,
  writeVelocity,
  parseMetrics,
} from '../learning-velocity-cron';
import { makeD1, SCHEMA } from '@/__tests__/integration/shared-d1-shim';
import type { LearningVelocityMetric } from '@/seed/types/learning-velocity';
import type { D1Database } from '@cloudflare/workers-types';

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

// learning_velocity table is not in the shared SCHEMA — add it on top.
const LEARNING_VELOCITY_SQL = `
CREATE TABLE IF NOT EXISTS learning_velocity (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  velocity_score REAL NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  window_start_ms INTEGER NOT NULL DEFAULT 0,
  window_end_ms INTEGER NOT NULL DEFAULT 0,
  avg_metrics TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0
);
`;

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  db.exec(LEARNING_VELOCITY_SQL);
  return db;
}

function makeEventRow(metrics: Record<string, number>) {
  return { metrics_json: JSON.stringify(metrics) };
}

// ---------------------------------------------------------------------------
// 1. computeVelocityScore — no data → 50
// ---------------------------------------------------------------------------

describe('computeVelocityScore — no data', () => {
  it('returns 50 for empty objects', () => {
    expect(computeVelocityScore({}, {})).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 2. computeVelocityScore — improvement (late > early) → score > 50
// ---------------------------------------------------------------------------

describe('computeVelocityScore — improvement', () => {
  it('returns > 50 when late values exceed early values', () => {
    const early = { clicks: 10, views: 100 };
    const late = { clicks: 30, views: 200 };
    const score = computeVelocityScore(early, late);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 100 for maximum improvement (late dominates, early is zero)', () => {
    const early = { ctr: 0 };
    const late = { ctr: 100 };
    expect(computeVelocityScore(early, late)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 3. computeVelocityScore — regression (late < early) → score < 50
// ---------------------------------------------------------------------------

describe('computeVelocityScore — regression', () => {
  it('returns < 50 when late values are below early values', () => {
    const early = { clicks: 50, views: 500 };
    const late = { clicks: 10, views: 100 };
    const score = computeVelocityScore(early, late);
    expect(score).toBeLessThan(50);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for maximum regression (early dominates, late is zero)', () => {
    const early = { ctr: 100 };
    const late = { ctr: 0 };
    expect(computeVelocityScore(early, late)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. computeVelocityScore — identical early/late → 50
// ---------------------------------------------------------------------------

describe('computeVelocityScore — identical', () => {
  it('returns 50 when early and late are equal', () => {
    const data = { impressions: 200, conversions: 15 };
    expect(computeVelocityScore(data, { ...data })).toBe(50);
  });

  it('returns 50 when all values are zero', () => {
    expect(computeVelocityScore({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 5. parseMetrics
// ---------------------------------------------------------------------------

describe('parseMetrics', () => {
  it('parses valid JSON into number-only record', () => {
    const row = { metrics_json: '{"a": 1, "b": "not-a-number", "c": 3.5}' };
    expect(parseMetrics(row)).toEqual({ a: 1, c: 3.5 });
  });

  it('returns empty object for invalid JSON', () => {
    expect(parseMetrics({ metrics_json: 'not-json' })).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(parseMetrics({ metrics_json: '' })).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 6. avgMetrics
// ---------------------------------------------------------------------------

describe('avgMetrics', () => {
  it('computes average across rows for each metric key', () => {
    const rows = [
      makeEventRow({ clicks: 10, views: 100 }),
      makeEventRow({ clicks: 20, views: 200 }),
      makeEventRow({ clicks: 30, views: 300 }),
    ];
    const result = avgMetrics(rows);
    expect(result.clicks).toBe(20);
    expect(result.views).toBe(200);
  });

  it('handles rows with missing keys gracefully', () => {
    const rows = [
      makeEventRow({ a: 10 }),
      makeEventRow({ b: 20 }),
    ];
    const result = avgMetrics(rows);
    expect(result.a).toBe(10);
    expect(result.b).toBe(20);
  });

  it('returns empty object for empty input', () => {
    expect(avgMetrics([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 7. computeVelocity — < 4 events → null
// ---------------------------------------------------------------------------

describe('computeVelocity — insufficient events', () => {
  let db: D1Database;

  beforeEach(() => {
    const raw = createTestDb();
    db = makeD1(raw) as unknown as D1Database;
  });

  it('returns null when no events exist', async () => {
    const result = await computeVelocity(
      db, 'ws-1', 'video', 'youtube', 1000, 1400, 2500,
    );
    expect(result).toBeNull();
  });

  it('returns null when fewer than 4 events', async () => {
    // Insert 3 events
    for (let i = 0; i < 3; i++) {
      await db.prepare(
        `INSERT INTO performance_events
         (id, workspace_id, entity_type, entity_id, channel, event_type, metrics_json, raw_data, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        `evt-${i}`, 'ws-1', 'video', `ent-${i}`, 'youtube', 'impression',
        JSON.stringify({ clicks: 10 + i, views: 100 + i * 10 }),
        JSON.stringify({ clicks: 10 + i, views: 100 + i * 10 }),
        1000 + i * 100,
      ).run();
    }

    const result = await computeVelocity(
      db, 'ws-1', 'video', 'youtube', 1000, 1400, 2500,
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. computeVelocity — >= 4 events → returns metric
// ---------------------------------------------------------------------------

describe('computeVelocity — sufficient events', () => {
  let db: D1Database;

  beforeEach(() => {
    const raw = createTestDb();
    db = makeD1(raw) as unknown as D1Database;
  });

  it('returns a metric with velocityScore and eventCount for >= 4 events', async () => {
    // Insert 10 events with improving trend (late events have higher metrics)
    for (let i = 0; i < 10; i++) {
      const baseMetric = 10 + i * 5; // steadily increasing
      await db.prepare(
        `INSERT INTO performance_events
         (id, workspace_id, entity_type, entity_id, channel, event_type, metrics_json, raw_data, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        `evt-${i}`, 'ws-1', 'video', `ent-${i}`, 'youtube', 'impression',
        JSON.stringify({ clicks: baseMetric, views: baseMetric * 10 }),
        JSON.stringify({ clicks: baseMetric, views: baseMetric * 10 }),
        1000 + i * 100,
      ).run();
    }

    const metric = await computeVelocity(
      db, 'ws-1', 'video', 'youtube', 1000, 1600, 2500,
    );

    expect(metric).not.toBeNull();
    expect(metric!.workspaceId).toBe('ws-1');
    expect(metric!.entityType).toBe('video');
    expect(metric!.channel).toBe('youtube');
    expect(metric!.eventCount).toBe(10);
    expect(metric!.velocityScore).toBeGreaterThanOrEqual(0);
    expect(metric!.velocityScore).toBeLessThanOrEqual(100);
    expect(metric!.velocityScore).toBeGreaterThan(50); // improving trend
    expect(metric!.windowStartMs).toBe(1000);
    expect(metric!.windowEndMs).toBe(2500);
    expect(metric!.id).toContain('vel_ws-1_video_youtube');
  });

  it('returns null when events fall outside the time window', async () => {
    // Insert events with recorded_at outside the query window
    for (let i = 0; i < 5; i++) {
      await db.prepare(
        `INSERT INTO performance_events
         (id, workspace_id, entity_type, entity_id, channel, event_type, metrics_json, raw_data, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        `evt-${i}`, 'ws-1', 'video', `ent-${i}`, 'youtube', 'impression',
        JSON.stringify({ clicks: 10 }),
        JSON.stringify({ clicks: 10 }),
        5000 + i * 100, // outside 1000–2500 window
      ).run();
    }

    const result = await computeVelocity(
      db, 'ws-1', 'video', 'youtube', 1000, 1400, 2500,
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9. writeVelocity — inserts and verifies
// ---------------------------------------------------------------------------

describe('writeVelocity — insert and verify', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  beforeEach(() => {
    rawDb = createTestDb();
    db = makeD1(rawDb) as unknown as D1Database;
  });

  it('inserts a metric row and SELECT confirms it', async () => {
    const metric: LearningVelocityMetric = {
      id: 'vel_ws-test_video_youtube_99999',
      workspaceId: 'ws-test',
      entityType: 'video',
      channel: 'youtube',
      velocityScore: 72,
      eventCount: 8,
      windowStartMs: 1000,
      windowEndMs: 5000,
      avgMetrics: { clicks: 25, views: 300 },
      createdAt: 99999,
    };

    await writeVelocity(db, metric);

    // Read it back
    const row = rawDb.prepare(
      'SELECT * FROM learning_velocity WHERE id = ?',
    ).get('vel_ws-test_video_youtube_99999') as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.workspace_id).toBe('ws-test');
    expect(row.entity_type).toBe('video');
    expect(row.channel).toBe('youtube');
    expect(row.velocity_score).toBe(72);
    expect(row.event_count).toBe(8);
    expect(row.window_start_ms).toBe(1000);
    expect(row.window_end_ms).toBe(5000);
    expect(JSON.parse(row.avg_metrics as string)).toEqual({ clicks: 25, views: 300 });
    expect(row.created_at).toBe(99999);
  });

  it('INSERT OR REPLACE overwrites existing row with same id', async () => {
    const metric: LearningVelocityMetric = {
      id: 'vel_dup_video_youtube_111',
      workspaceId: 'ws-1',
      entityType: 'video',
      channel: 'youtube',
      velocityScore: 40,
      eventCount: 5,
      windowStartMs: 1000,
      windowEndMs: 2000,
      avgMetrics: { ctr: 0.1 },
      createdAt: 111,
    };

    await writeVelocity(db, metric);

    // Overwrite with updated score
    const updated: LearningVelocityMetric = { ...metric, velocityScore: 85, eventCount: 12 };
    await writeVelocity(db, updated);

    const row = rawDb.prepare(
      'SELECT velocity_score, event_count FROM learning_velocity WHERE id = ?',
    ).get('vel_dup_video_youtube_111') as Record<string, unknown>;

    expect(row.velocity_score).toBe(85);
    expect(row.event_count).toBe(12);

    // Confirm only one row exists
    const count = rawDb.prepare(
      'SELECT COUNT(*) as cnt FROM learning_velocity WHERE id = ?',
    ).get('vel_dup_video_youtube_111') as Record<string, unknown>;
    expect(count.cnt).toBe(1);
  });
});
