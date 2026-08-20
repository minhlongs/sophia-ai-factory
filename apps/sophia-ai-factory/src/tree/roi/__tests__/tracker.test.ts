/**
 * ROI Tracker Tests — Phase 4: Creative Learning Loop
 *
 * Covers recordROI ROI computation edge cases and the two aggregate
 * queries (getWorkspaceROI, getTopROIChannels) using better-sqlite3
 * as an in-memory D1 shim.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const ROI_TABLE = `
CREATE TABLE IF NOT EXISTS roi_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  revenue_cents INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,
  roi REAL NOT NULL,
  channel TEXT,
  recorded_at INTEGER NOT NULL
)
`;

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

import { recordROI, getWorkspaceROI, getTopROIChannels } from '../tracker';

function makeD1(db: InstanceType<typeof Database>) {
  return {
    prepare(sql: string) {
      const normalized = sql.replace(/\?(\d+)/g, '?');
      const stmt = db.prepare(normalized);
      return {
        bind(...params: unknown[]) {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              return (stmt.get(...sanitized) as T) ?? null;
            },
            async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
              return { results: stmt.all(...sanitized) as T[] };
            },
            async run(): Promise<{ meta: { changes: number } }> {
              const info = stmt.run(...sanitized);
              return { meta: { changes: info.changes } };
            },
          };
        },
      };
    },
    exec(sql: string) {
      db.exec(sql);
    },
  };
}

function createTestDb(): ReturnType<typeof makeD1> {
  const db = new Database(':memory:');
  db.exec(ROI_TABLE);
  return makeD1(db);
}

describe('recordROI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns roi = 0 when costCents = 0 and revenueCents = 0', async () => {
    mockGetD1.mockResolvedValue(createTestDb());

    const result = await recordROI({
      workspaceId: 'ws-1',
      entityType: 'mission',
      entityId: 'm-1',
      revenueCents: 0,
      costCents: 0,
      recordedAt: Date.now(),
    });

    expect(result.roi).toBe(0);
  });

  it('returns roi = 100 when costCents = 0 and revenueCents > 0 (free revenue)', async () => {
    mockGetD1.mockResolvedValue(createTestDb());

    const result = await recordROI({
      workspaceId: 'ws-1',
      entityType: 'mission',
      entityId: 'm-2',
      revenueCents: 500,
      costCents: 0,
      recordedAt: Date.now(),
    });

    expect(result.roi).toBe(100);
    expect(result.revenueCents).toBe(500);
  });

  it('computes positive roi when revenue > cost', async () => {
    mockGetD1.mockResolvedValue(createTestDb());

    const result = await recordROI({
      workspaceId: 'ws-1',
      entityType: 'mission',
      entityId: 'm-3',
      revenueCents: 1500,
      costCents: 1000,
      recordedAt: Date.now(),
    });

    expect(result.roi).toBeCloseTo(50, 5);
  });

  it('computes negative roi when revenue < cost', async () => {
    mockGetD1.mockResolvedValue(createTestDb());

    const result = await recordROI({
      workspaceId: 'ws-1',
      entityType: 'mission',
      entityId: 'm-4',
      revenueCents: 500,
      costCents: 1000,
      recordedAt: Date.now(),
    });

    expect(result.roi).toBeCloseTo(-50, 5);
  });

  it('returns roi = 0 when revenue == cost', async () => {
    mockGetD1.mockResolvedValue(createTestDb());

    const result = await recordROI({
      workspaceId: 'ws-1',
      entityType: 'mission',
      entityId: 'm-5',
      revenueCents: 1000,
      costCents: 1000,
      recordedAt: Date.now(),
    });

    expect(result.roi).toBe(0);
  });

  it('persists the record into roi_records', async () => {
    const d1 = createTestDb();
    mockGetD1.mockResolvedValue(d1);

    await recordROI({
      workspaceId: 'ws-persist',
      entityType: 'asset',
      entityId: 'a-1',
      revenueCents: 2000,
      costCents: 500,
      channel: 'youtube',
      recordedAt: 1700000000000,
    });

    const rows = await d1
      .prepare('SELECT * FROM roi_records WHERE workspace_id = ?')
      .bind('ws-persist')
      .all<{ entity_type: string; channel: string; roi: number }>();

    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]!.entity_type).toBe('asset');
    expect(rows.results[0]!.channel).toBe('youtube');
    expect(rows.results[0]!.roi).toBeCloseTo(300, 5);
  });
});

describe('getWorkspaceROI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no records exist for workspace', async () => {
    mockGetD1.mockResolvedValue(createTestDb());

    const result = await getWorkspaceROI('empty-ws');
    expect(result).toBeNull();
  });

  it('returns aggregate with correct totals', async () => {
    const d1 = createTestDb();
    mockGetD1.mockResolvedValue(d1);

    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r1', 'ws-agg', 'mission', 'm-1', 1500, 1000, 50, 'youtube', 1000)
      .run();
    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r2', 'ws-agg', 'mission', 'm-2', 500, 1000, -50, 'youtube', 2000)
      .run();

    const result = await getWorkspaceROI('ws-agg');

    expect(result).not.toBeNull();
    expect(result!.totalRevenueCents).toBe(2000);
    expect(result!.totalCostCents).toBe(2000);
    expect(result!.roi).toBe(0);
    expect(result!.unitCount).toBe(2);
    expect(result!.avgRevenuePerUnit).toBe(1000);
    expect(result!.avgCostPerUnit).toBe(1000);
  });

  it('filters by channel', async () => {
    const d1 = createTestDb();
    mockGetD1.mockResolvedValue(d1);

    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r1', 'ws-chan', 'mission', 'm-1', 1500, 1000, 50, 'youtube', 1000)
      .run();
    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r2', 'ws-chan', 'mission', 'm-2', 500, 1000, -50, 'tiktok', 2000)
      .run();

    const result = await getWorkspaceROI('ws-chan', { channel: 'youtube' });

    expect(result).not.toBeNull();
    expect(result!.channel).toBe('youtube');
    expect(result!.totalRevenueCents).toBe(1500);
    expect(result!.unitCount).toBe(1);
  });

  it('filters by since timestamp', async () => {
    const d1 = createTestDb();
    mockGetD1.mockResolvedValue(d1);

    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r1', 'ws-since', 'mission', 'm-1', 1500, 1000, 50, 'youtube', 1000)
      .run();
    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r2', 'ws-since', 'mission', 'm-2', 500, 1000, -50, 'youtube', 3000)
      .run();

    const result = await getWorkspaceROI('ws-since', { since: 2000 });

    expect(result).not.toBeNull();
    expect(result!.unitCount).toBe(1);
    expect(result!.totalRevenueCents).toBe(500);
  });
});

describe('getTopROIChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns records sorted by total revenue descending', async () => {
    const d1 = createTestDb();
    mockGetD1.mockResolvedValue(d1);

    // youtube: rev=1000, cost=500, roi=100
    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r1', 'ws-top', 'mission', 'm-1', 1000, 500, 100, 'youtube', 1000)
      .run();
    // tiktok: rev=500, cost=1000, roi=-50
    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r2', 'ws-top', 'mission', 'm-2', 500, 1000, -50, 'tiktok', 1000)
      .run();
    // facebook: rev=2000, cost=1000, roi=100
    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r3', 'ws-top', 'mission', 'm-3', 2000, 1000, 100, 'facebook', 1000)
      .run();

    const results = await getTopROIChannels('ws-top');

    expect(results).toHaveLength(3);
    // Sorted by total_revenue DESC per SQL; facebook (2000) > youtube (1000) > tiktok (500)
    expect(results[0]!.channel).toBe('facebook');
    expect(results[0]!.totalRevenueCents).toBe(2000);
    expect(results[0]!.roi).toBeCloseTo(100, 5);
    expect(results[1]!.channel).toBe('youtube');
    expect(results[2]!.channel).toBe('tiktok');
    expect(results[2]!.roi).toBeCloseTo(-50, 5);
  });

  it('respects the limit parameter', async () => {
    const d1 = createTestDb();
    mockGetD1.mockResolvedValue(d1);

    for (let i = 0; i < 5; i++) {
      await d1
        .prepare(
          `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(`r${i}`, 'ws-limit', 'mission', `m-${i}`, 1000 + i * 100, 500, 100, `channel-${i}`, 1000)
        .run();
    }

    const results = await getTopROIChannels('ws-limit', 2);

    expect(results).toHaveLength(2);
  });

  it('returns empty array when no records exist', async () => {
    mockGetD1.mockResolvedValue(createTestDb());

    const results = await getTopROIChannels('empty-ws');
    expect(results).toEqual([]);
  });

  it('filters by since timestamp', async () => {
    const d1 = createTestDb();
    mockGetD1.mockResolvedValue(d1);

    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r1', 'ws-since-top', 'mission', 'm-1', 1000, 500, 100, 'youtube', 1000)
      .run();
    await d1
      .prepare(
        `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r2', 'ws-since-top', 'mission', 'm-2', 500, 1000, -50, 'tiktok', 3000)
      .run();

    const results = await getTopROIChannels('ws-since-top', 10, 2000);

    expect(results).toHaveLength(1);
    expect(results[0]!.channel).toBe('tiktok');
  });
});