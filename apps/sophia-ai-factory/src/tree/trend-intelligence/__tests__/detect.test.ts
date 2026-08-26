/**
 * Trend detection pipeline integration tests — DB-backed via node:sqlite D1
 * shim (mirrors src/tree/content-graph/__tests__/integration.test.ts).
 *
 * Seeds market_signals through the REAL Lane B store (createSignal) and
 * performance_events through the REAL events repository, then runs
 * detectTrends end-to-end against an in-memory SQLite DB carrying the exact
 * column shapes of migrations 0255 / 0256 / 0243.
 *
 * @module tree/trend-intelligence/__tests__/detect-integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (p: string) => {
    exec(s: string): void;
    prepare(s: string): {
      get(...p: unknown[]): unknown;
      all(...p: unknown[]): unknown[];
      run(...p: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

// Column shapes mirror migrations 0255_market_signals / 0256_trend_detections
// and the canonical performance_events schema (migration 0243 family).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS market_signals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trend', 'competitor', 'audience', 'search', 'content', 'market')),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 0,
  relevance_score REAL NOT NULL DEFAULT 0,
  expires_at INTEGER,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_ms_ws ON market_signals(workspace_id, type, created_at DESC);
CREATE TABLE IF NOT EXISTS trend_detections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  channel TEXT,
  momentum REAL NOT NULL DEFAULT 0,
  forecast TEXT,
  evidence_ids TEXT,
  detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_td_ws ON trend_detections(workspace_id, detected_at DESC);
CREATE TABLE IF NOT EXISTS performance_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL DEFAULT '',
  project_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  channel TEXT,
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  value_cents INTEGER NOT NULL DEFAULT 0,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  recorded_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  raw_data TEXT
);
`;

function setupRawDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(SCHEMA);
  return raw;
}

const { createServerClient, getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: vi.fn(),
}));

// Partial store mock: everything stays REAL except consumeSignals, whose
// failure path is exercised explicitly below.
vi.mock('@/tree/market-signals/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tree/market-signals/store')>();
  return { ...actual, consumeSignals: vi.fn(actual.consumeSignals) };
});

import * as store from '@/tree/market-signals/store';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { recordPerformanceEvent } from '@/tree/performance/events';
import { PerformanceError } from '@/tree/performance/errors';
import { detectTrends } from '@/tree/trend-intelligence/detect';

let raw: ReturnType<typeof setupRawDb>;
let d1: ReturnType<typeof makeD1>;

function makeD1(db: ReturnType<typeof setupRawDb>) {
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
            all: async <T = Record<string, unknown>>() => ({
              results: stmt.all(...sanitized) as T[],
              meta: { changes: 0, duration: 0 },
            }),
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => ({ success: true, meta: { changes: 0, duration: 0 } }),
        all: async <T = Record<string, unknown>>() => ({
          results: stmt.all() as T[],
          meta: { changes: 0, duration: 0 },
        }),
      };
    },
    exec: (s: string) => db.exec(s),
    batch: (stmts: unknown[]) => Promise.all(stmts),
  };
}

/** One signal per given ms timestamp, sharing the same title/source. */
async function seedSignals(title: string, timestamps: number[]) {
  let n = 0;
  for (const at of timestamps) {
    n += 1;
    const result = await store.createSignal({
      workspaceId: 'ws_trend',
      type: 'trend',
      source: 'youtube',
      title,
      summary: `${title} summary ${n}`,
      data: { videoId: `vid_${n}` },
      confidence: 0.8,
      relevanceScore: 0.7,
      createdAt: at,
    });
    expect(result.ok).toBe(true);
  }
}

async function seedEvent(eventType: string, at: number, count = 1) {
  await recordPerformanceEvent({
    id: `pevt_${eventType}_${at}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: 'ws_trend',
    assetId: '',
    projectId: '',
    entityType: 'asset',
    entityId: 'asset_x',
    channel: 'youtube',
    eventType,
    count,
    recordedAt: at,
  });
}

/** Rising profile: 1 signal/day for days −6..−2, then a burst of 8 today. */
function risingTimestamps(): number[] {
  const ts: number[] = [];
  for (let d = 6; d >= 2; d--) ts.push(T0 - d * DAY + 3600_000);
  for (let i = 0; i < 8; i++) ts.push(T0 - 23 * 3600_000 + i * 60_000);
  return ts;
}

/**
 * Flat profile: 1 signal/day across the whole 7-day window → velocity 0, z 0.
 * Offset is −1h (not +1h) so today's signal stays BEFORE nowMs — a +1h stamp
 * would land in the future half-open boundary and drop out of the window.
 */
function flatTimestamps(): number[] {
  const ts: number[] = [];
  for (let d = 6; d >= 0; d--) {
    ts.push(T0 - d * DAY - 3600_000);
  }
  return ts;
}

beforeEach(() => {
  raw = setupRawDb();
  d1 = makeD1(raw);
  vi.mocked(createServerClient).mockReturnValue({ unwrap: () => d1 } as never);
  vi.mocked(getD1).mockResolvedValue(d1 as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('detectTrends — integration (signals → detections)', () => {
  it('persists ranked detections with forecasts and consumes processed signals', async () => {
    await seedSignals('QuantumLeap X2 unveiled', risingTimestamps());
    await seedSignals('Evergreen Gardening Guide', flatTimestamps());
    // Performance events: views burst recently, clicks stay flat.
    for (let d = 6; d >= 2; d--) {
      await seedEvent('view', T0 - d * DAY + 3600_000);
      await seedEvent('view', T0 - d * DAY + 5400_000);
      await seedEvent('click', T0 - d * DAY + 3600_000);
    }
    for (let i = 0; i < 10; i++) await seedEvent('view', T0 - 20 * 3600_000 + i * 60_000);

    const result = await detectTrends({ workspaceId: 'ws_trend', nowMs: T0, consumeProcessed: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const records = result.value;
    expect(records.length).toBeGreaterThanOrEqual(4);

    // Sane momentum ordering: strictly non-increasing.
    for (let i = 1; i < records.length; i++) {
      expect(records[i - 1].momentum).toBeGreaterThanOrEqual(records[i].momentum);
    }

    // The bursting topic outranks the flat topic.
    const burst = records.find((r) => r.topic === 'quantumleap');
    const flat = records.find((r) => r.topic === 'evergreen');
    expect(burst).toBeDefined();
    expect(flat).toBeDefined();
    expect(burst!.momentum).toBeGreaterThan(0);
    expect(flat!.momentum).toBe(0);
    expect(burst!.momentum).toBeGreaterThan(flat!.momentum);

    // Evidence round-trip: every in-window rising signal id is cited.
    expect(burst!.evidenceIds).toHaveLength(risingTimestamps().length);

    // Forecast contract: 7-day horizon with sane intervals.
    expect(burst!.forecast.horizonSteps).toBe(7);
    expect(burst!.forecast.points).toHaveLength(7);
    expect(burst!.forecast.generatedAt).toBe(T0);
    for (const point of burst!.forecast.points) {
      expect(point.upper).toBeGreaterThanOrEqual(point.projected);
      expect(point.projected).toBeGreaterThanOrEqual(point.lower);
    }

    // Rows actually landed in trend_detections with parseable JSON payloads.
    const rows = raw.prepare(
      `SELECT * FROM trend_detections WHERE workspace_id = ? ORDER BY momentum DESC`,
    ).all('ws_trend') as Array<{
      id: string; workspace_id: string; topic: string; channel: string;
      momentum: number; forecast: string; evidence_ids: string; detected_at: number;
    }>;
    expect(rows.length).toBe(records.length);
    const topRow = rows.find((r) => r.topic === 'quantumleap');
    expect(topRow).toBeDefined();
    expect(topRow!.detected_at).toBe(T0);
    expect(topRow!.channel).toBe('youtube');
    const parsedForecast = JSON.parse(topRow!.forecast) as { horizonSteps: number };
    expect(parsedForecast.horizonSteps).toBe(7);
    const parsedEvidence = JSON.parse(topRow!.evidence_ids) as string[];
    expect(parsedEvidence).toHaveLength(risingTimestamps().length);

    // Consumed flag closed the loop for processed signals.
    const consumedCount = raw.prepare(
      `SELECT COUNT(*) AS c FROM market_signals WHERE workspace_id = ? AND consumed = 1`,
    ).get('ws_trend') as { c: number };
    expect(consumedCount.c).toBe(risingTimestamps().length + flatTimestamps().length);
  });

  it('returns success with zero detections for a workspace without data', async () => {
    const result = await detectTrends({ workspaceId: 'ws_empty', nowMs: T0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
    const rows = raw.prepare(`SELECT COUNT(*) AS c FROM trend_detections`).get() as { c: number };
    expect(rows.c).toBe(0);
  });

  it('honors maxDetections cap', async () => {
    await seedSignals('QuantumLeap X2 unveiled', risingTimestamps());
    await seedSignals('Evergreen Gardening Guide', flatTimestamps());

    const result = await detectTrends({ workspaceId: 'ws_trend', nowMs: T0, maxDetections: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
    const rows = raw.prepare(`SELECT COUNT(*) AS c FROM trend_detections`).get() as { c: number };
    expect(rows.c).toBe(2);
  });

  it('fails soft when D1 is unavailable for performance events', async () => {
    await seedSignals('QuantumLeap X2 unveiled', risingTimestamps());
    vi.mocked(getD1).mockResolvedValue(null as never);

    const result = await detectTrends({ workspaceId: 'ws_trend', nowMs: T0 });
    expect(result.ok).toBe(false);
    // PerformanceError carries the machine code on `.code`, human message on `.message`.
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PerformanceError);
      if (result.error instanceof PerformanceError) {
        expect(result.error.code).toBe('D1_UNAVAILABLE');
      }
      expect(result.error.message).toContain('D1 not available');
    }
  });

  it('propagates store failures without throwing', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      unwrap: () => {
        throw new Error('binding missing');
      },
    } as never);

    const result = await detectTrends({ workspaceId: 'ws_trend', nowMs: T0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('binding missing');
  });

  it('warns and still succeeds when consumeSignals fails after detection', async () => {
    await seedSignals('QuantumLeap X2 unveiled', risingTimestamps());
    vi.mocked(store.consumeSignals).mockResolvedValueOnce(failure(new Error('consume write lost')));
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const result = await detectTrends({ workspaceId: 'ws_trend', nowMs: T0, consumeProcessed: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.length).toBeGreaterThanOrEqual(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[trend-intelligence.detect] consumeSignals failed after detection',
      expect.objectContaining({ workspaceId: 'ws_trend' }),
    );
    // Nothing got marked consumed — the failure was surfaced, not swallowed.
    const consumed = raw.prepare(
      `SELECT COUNT(*) AS c FROM market_signals WHERE consumed = 1`,
    ).get() as { c: number };
    expect(consumed.c).toBe(0);
    warnSpy.mockRestore();
  });

  it('wraps non-Error throws into a failure result', async () => {
    await seedSignals('QuantumLeap X2 unveiled', risingTimestamps());
    // getD1 rejecting with a bare string exercises the non-Error wrap branch.
    vi.mocked(getD1).mockRejectedValue('string fault' as never);

    const result = await detectTrends({ workspaceId: 'ws_trend', nowMs: T0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('string fault');
  });

  it('uses default windows/clock and drops evidence entirely outside the window', async () => {
    // One stale-but-unexpired signal, 30 days old: listSignals still returns
    // it, but it falls outside the implicit 7×24h window ending at Date.now().
    await seedSignals('Ancient Stale Topic', [T0 - 30 * DAY]);

    const result = await detectTrends({ workspaceId: 'ws_trend' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
    const rows = raw.prepare(`SELECT COUNT(*) AS c FROM trend_detections`).get() as { c: number };
    expect(rows.c).toBe(0);
  });

  it('tolerates insert results without change metadata', async () => {
    await seedSignals('QuantumLeap X2 unveiled', risingTimestamps());
    // Sparse binding only for INSERTs — reads keep the full shim.
    vi.mocked(createServerClient).mockReturnValue({
      unwrap: () => ({
        prepare: (sql: string) =>
          sql.includes('INSERT')
            ? { bind: () => ({ run: async () => ({ success: true }) }) }
            : d1.prepare(sql),
      }),
    } as never);

    const result = await detectTrends({ workspaceId: 'ws_trend', nowMs: T0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.length).toBeGreaterThanOrEqual(1);
  });

  it('skips expired signals entirely', async () => {
    await store.createSignal({
      workspaceId: 'ws_trend',
      type: 'trend',
      source: 'youtube',
      title: 'Stale Expired Gadget',
      summary: 'expired long ago',
      data: {},
      confidence: 0.9,
      relevanceScore: 0.9,
      expiresAt: T0 - 10 * DAY,
      createdAt: T0 - DAY,
    });

    const result = await detectTrends({ workspaceId: 'ws_trend', nowMs: T0 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.find((r) => r.topic === 'stale')).toBeUndefined();
    }
  });
});
