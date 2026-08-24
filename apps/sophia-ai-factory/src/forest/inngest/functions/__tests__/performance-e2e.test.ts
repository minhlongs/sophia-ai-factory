/**
 * E2E tests for Creative Learning Loop schema alignment.
 *
 * Verifies:
 *   1. recordPerformanceEvent writes metrics_json (canonical) + raw_data
 *   2. Crons that SELECT metrics_json get non-NULL data (mergeMetrics,
 *      computeVelocity over rows written through the repository INSERT)
 *   3. variantAbSelector + abWinnerPickerCron are registered in serve()
 *
 * @module forest/inngest/functions/__tests__/performance-e2e
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const { mockGetD1, serveMock } = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  serveMock: vi.fn((_opts: { functions: unknown[] }) => ({
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
  })),
}));

vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/tree/creative-memory', () => ({
  upsertMemory: vi.fn().mockResolvedValue(undefined),
  recordLearning: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('inngest/next', () => ({ serve: serveMock }));

import { makeD1, SCHEMA } from '@/__tests__/integration/shared-d1-shim';
import {
  newPerformanceEventId,
  recordPerformanceEvent,
} from '@/tree/performance';
import { mergeMetrics } from '../performance-aggregation';
import { computeVelocity } from '../learning-velocity-cron';

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

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return db;
}

describe('Schema alignment — recordPerformanceEvent writes metrics_json', () => {
  beforeEach(() => {
    mockGetD1.mockReset();
  });

  it('INSERT via repository persists parseable metrics_json and raw_data', async () => {
    const raw = createTestDb();
    mockGetD1.mockResolvedValue(makeD1(raw));

    await recordPerformanceEvent({
      id: newPerformanceEventId(),
      workspaceId: 'ws-e2e',
      assetId: '',
      projectId: '',
      entityType: 'video',
      entityId: 'ent-1',
      channel: 'youtube',
      eventType: 'impression',
      count: 1,
      valueCents: 25,
      rawData: { impressions: 500, clicks: 12 },
      recordedAt: Date.now(),
    });

    const row = raw
      .prepare('SELECT metrics_json, raw_data FROM performance_events')
      .get() as Record<string, unknown>;

    expect(row.metrics_json).toBe(JSON.stringify({ impressions: 500, clicks: 12 }));
    expect(row.raw_data).toBe(JSON.stringify({ impressions: 500, clicks: 12 }));
  });

  it('INSERT with asset_id persists and round-trips correctly', async () => {
    const raw = createTestDb();
    mockGetD1.mockResolvedValue(makeD1(raw));

    await recordPerformanceEvent({
      id: newPerformanceEventId(),
      workspaceId: 'ws-e2e',
      assetId: 'asset_video_001',
      projectId: 'proj_alpha',
      entityType: 'video',
      entityId: 'vid-1',
      channel: 'youtube',
      eventType: 'impression',
      count: 1,
      valueCents: 10,
      rawData: { views: 1000 },
      recordedAt: Date.now(),
    });

    const row = raw
      .prepare('SELECT asset_id, project_id, channel FROM performance_events')
      .get() as Record<string, unknown>;

    expect(row.asset_id).toBe('asset_video_001');
    expect(row.project_id).toBe('proj_alpha');
    expect(row.channel).toBe('youtube');
  });

  it('absent rawData serializes to {} so NOT NULL metrics_json stays valid', async () => {
    const raw = createTestDb();
    mockGetD1.mockResolvedValue(makeD1(raw));

    await recordPerformanceEvent({
      id: newPerformanceEventId(),
      workspaceId: 'ws-e2e',
      assetId: '',
      projectId: '',
      entityType: 'mission',
      entityId: 'm-1',
      channel: 'agent',
      eventType: 'mission_completed',
      count: 1,
      recordedAt: Date.now(),
    });

    const row = raw
      .prepare('SELECT metrics_json FROM performance_events')
      .get() as Record<string, unknown>;
    expect(row.metrics_json).toBe('{}');
  });
});

describe('Crons read metrics_json written by the repository', () => {
  beforeEach(() => {
    mockGetD1.mockReset();
  });

  it('mergeMetrics averages values from persisted metrics_json rows', async () => {
    const raw = createTestDb();
    mockGetD1.mockResolvedValue(makeD1(raw));

    for (const clicks of [10, 30]) {
      await recordPerformanceEvent({
        id: newPerformanceEventId(),
        workspaceId: 'ws-merge',
        assetId: '',
        projectId: '',
        entityType: 'video',
        entityId: 'ent-1',
        channel: 'youtube',
        eventType: 'click',
        count: 1,
        rawData: { clicks },
        recordedAt: Date.now(),
      });
    }

    const rows = raw
      .prepare('SELECT metrics_json FROM performance_events')
      .all() as Array<Record<string, unknown>>;
    const merged = mergeMetrics(
      rows.map((r) => ({ metrics_json: r.metrics_json as string })),
    );
    expect(merged.clicks).toBe(20);
  });

  it('computeVelocity returns a non-null metric from >=4 persisted events', async () => {
    const raw = createTestDb();
    mockGetD1.mockResolvedValue(makeD1(raw));

    for (let i = 0; i < 6; i++) {
      await recordPerformanceEvent({
        id: newPerformanceEventId(),
        workspaceId: 'ws-vel',
        assetId: '',
        projectId: '',
        entityType: 'video',
        entityId: `ent-${i}`,
        channel: 'youtube',
        eventType: 'impression',
        count: 1,
        rawData: { ctr: 10 + i * 5 },
        recordedAt: 1000 + i * 100,
      });
    }

    const metric = await computeVelocity(
      makeD1(raw) as unknown as Parameters<typeof computeVelocity>[0],
      'ws-vel', 'video', 'youtube', 1000, 1200, 1700,
    );
    expect(metric).not.toBeNull();
    expect(metric!.eventCount).toBe(6);
    expect(metric!.velocityScore).toBeGreaterThanOrEqual(0);
    expect(metric!.velocityScore).toBeLessThanOrEqual(100);
  });
});

describe('Inngest serve — A/B crons registered', () => {
  it('variantAbSelector and abWinnerPickerCron appear in serve functions', async () => {
    const barrel = await import('@/forest/inngest/functions/index');
    await import('@/app/api/inngest/route');

    const opts = serveMock.mock.calls[0]?.[0] as { functions: unknown[] } | undefined;
    expect(opts).toBeDefined();
    if (!opts) return;

    expect(opts.functions).toContain(barrel.variantAbSelector);
    expect(opts.functions).toContain(barrel.abWinnerPickerCron);
  });
});
