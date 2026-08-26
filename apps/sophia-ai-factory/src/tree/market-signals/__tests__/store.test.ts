/**
 * Market Signals Store — Unit tests.
 * Covers CRUD, expiry filter, dedupe upsert.
 *
 * Uses shared real-SQLite D1 shim @/__tests__/integration/shared-d1-shim.
 *
 * @module tree/market-signals/__tests__/store
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import type { Result } from '@/seed/types/result';
import type { MarketSignal } from '@/seed/types/creative-domain';
import { makeD1, SCHEMA } from '@/__tests__/integration/shared-d1-shim';

/**
 * Assert a Result is a success and return its narrowed value.
 * `expect(result.ok).toBe(true)` alone does not narrow the discriminated
 * union for TypeScript, so every `.value` access below goes through this.
 */
function expectOk<T, E>(r: Result<T, E>): T {
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error('expected success result');
  return r.value;
}

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

const { createServerClient } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn() }));

beforeEach(() => {
  vi.mocked(createServerClient).mockReset();
});

function setupDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  // Add market_signals table with dedupe columns
  db.exec(`
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
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      title_hash TEXT,
      day_window_start INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_market_signals_workspace_type ON market_signals(workspace_id, type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_market_signals_consumed ON market_signals(consumed, expires_at);
    CREATE INDEX IF NOT EXISTS idx_market_signals_dedupe ON market_signals(workspace_id, source, title_hash, day_window_start);
  `);
  return makeD1(db);
}

import * as store from '@/tree/market-signals/store';

describe('MarketSignal Store', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    vi.mocked(createServerClient).mockReturnValue({
      unwrap: () => db,
    } as ReturnType<typeof createServerClient>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const makeSignal = (overrides: Partial<Parameters<typeof store.createSignal>[0]> = {}) => ({
    workspaceId: 'ws-test',
    type: 'trend' as const,
    source: 'youtube',
    title: 'Test Trend Signal',
    summary: 'Test summary',
    data: { videoId: 'vid123', viewCount: 10000 },
    confidence: 0.8,
    relevanceScore: 0.7,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  });

  describe('createSignal', () => {
    it('creates a new signal with generated id and timestamp', async () => {
      const input = makeSignal();
      const result = await store.createSignal(input);

      const value = expectOk(result);
      expect(value.id).toBeDefined();
      expect(value.createdAt).toBeDefined();
      expect(value.consumed).toBe(false);
      expect(value.workspaceId).toBe('ws-test');
      expect(value.type).toBe('trend');
    });

    it('respects provided consumed flag', async () => {
      const input = makeSignal({ consumed: true });
      const result = await store.createSignal(input);

      const value = expectOk(result);
      expect(value.consumed).toBe(true);
    });
  });

  describe('insertSignal / getSignal', () => {
    it('inserts and retrieves a signal by id', async () => {
      const input = makeSignal();
      const createdValue = expectOk(await store.createSignal(input));

      const fetchedValue = expectOk(await store.getSignal(createdValue.id));
      expect(fetchedValue).not.toBeNull();
      expect(fetchedValue!.id).toBe(createdValue.id);
      expect(fetchedValue!.title).toBe(input.title);
      expect(fetchedValue!.data).toEqual(input.data);
    });

    it('returns null for non-existent id', async () => {
      const fetchedValue = expectOk(await store.getSignal('non-existent-id'));
      expect(fetchedValue).toBeNull();
    });
  });

  describe('listSignals', () => {
    beforeEach(async () => {
      // Insert test signals
      await store.createSignal(makeSignal({ id: 'sig-1', type: 'trend', source: 'youtube', title: 'Trend 1', createdAt: 1000 }));
      await store.createSignal(makeSignal({ id: 'sig-2', type: 'search', source: 'google-trends-rss', title: 'Search 1', createdAt: 2000 }));
      await store.createSignal(makeSignal({ id: 'sig-3', type: 'trend', source: 'youtube', title: 'Trend 2', consumed: true, createdAt: 3000 }));
    });

    it('lists all signals for workspace', async () => {
      const result = await store.listSignals({ workspaceId: 'ws-test', limit: 10 });
      expect(expectOk(result).length).toBe(3);
    });

    it('filters by type', async () => {
      const result = await store.listSignals({ workspaceId: 'ws-test', type: 'trend' });
      const value = expectOk(result);
      expect(value.length).toBe(2);
      expect(value.every(s => s.type === 'trend')).toBe(true);
    });

    it('filters by source', async () => {
      const result = await store.listSignals({ workspaceId: 'ws-test', source: 'youtube' });
      const value = expectOk(result);
      expect(value.length).toBe(2);
      expect(value.every(s => s.source === 'youtube')).toBe(true);
    });

    it('filters by consumed', async () => {
      const result = await store.listSignals({ workspaceId: 'ws-test', consumed: false });
      const value = expectOk(result);
      expect(value.length).toBe(2);
      expect(value.every(s => !s.consumed)).toBe(true);
    });

    it('excludes expired by default', async () => {
      const expiredSignal = makeSignal({
        id: 'sig-expired',
        expiresAt: Date.now() - 1000,
        title: 'Expired',
      });
      await store.createSignal(expiredSignal);

      const result = await store.listSignals({ workspaceId: 'ws-test' });
      expect(expectOk(result).find(s => s.id === 'sig-expired')).toBeUndefined();
    });

    it('includes expired when includeExpired=true', async () => {
      const expiredSignal = makeSignal({
        id: 'sig-expired',
        expiresAt: Date.now() - 1000,
        title: 'Expired',
      });
      await store.createSignal(expiredSignal);

      const result = await store.listSignals({ workspaceId: 'ws-test', includeExpired: true });
      expect(expectOk(result).find(s => s.id === 'sig-expired')).toBeDefined();
    });

    it('respects limit and offset', async () => {
      const result = await store.listSignals({ workspaceId: 'ws-test', limit: 2, offset: 1 });
      expect(expectOk(result).length).toBe(2);
    });
  });

  describe('upsertSignal', () => {
    // upsertSignal takes a full MarketSignal — build one explicitly with the
    // required fields that makeSignal() leaves optional for createSignal.
    function makeFullSignal(overrides: Partial<MarketSignal> & { id: string }): MarketSignal {
      return { ...makeSignal(overrides), consumed: false, createdAt: 1000, ...overrides };
    }

    it('inserts new signal if not exists', async () => {
      const signal = makeFullSignal({ id: 'upsert-new', title: 'New Signal' });
      const result = await store.upsertSignal(signal);

      const value = expectOk(result);
      expect(value.id).toBe('upsert-new');
    });

    it('updates existing signal by id', async () => {
      const base = makeFullSignal({ id: 'upsert-existing', title: 'Original' });
      await store.createSignal(base);

      const updated = makeFullSignal({ id: 'upsert-existing', title: 'Updated', confidence: 0.9 });
      const result = await store.upsertSignal(updated);

      const value = expectOk(result);
      expect(value.title).toBe('Updated');
      expect(value.confidence).toBe(0.9);

      const fetchedValue = expectOk(await store.getSignal('upsert-existing'));
      expect(fetchedValue!.title).toBe('Updated');
    });
  });

  describe('upsertSignalDeduped', () => {
    it('inserts new signal when no duplicate exists', async () => {
      const signal = makeSignal({ title: 'Unique Signal', source: 'test-source' });
      const result = await store.upsertSignalDeduped(signal);

      const value = expectOk(result);
      expect(value.title).toBe('Unique Signal');
    });

    it('returns existing signal on duplicate (same source, title-hash, day-window)', async () => {
      const signal = makeSignal({ title: 'Duplicate Test', source: 'test-source' });
      const first = expectOk(await store.upsertSignalDeduped(signal));

      // Same title, same source, same day window -> should dedupe
      const duplicate = makeSignal({ id: 'different-id', title: 'Duplicate Test', source: 'test-source' });
      const second = expectOk(await store.upsertSignalDeduped(duplicate));

      // Should return the original signal (same id)
      expect(second.id).toBe(first.id);
      expect(second.title).toBe('Duplicate Test');
    });

    it('allows same title from different source', async () => {
      const signal1 = makeSignal({ title: 'Same Title', source: 'youtube' });
      const first = expectOk(await store.upsertSignalDeduped(signal1));

      const signal2 = makeSignal({ id: 'different-id', title: 'Same Title', source: 'google-trends-rss' });
      const second = expectOk(await store.upsertSignalDeduped(signal2));

      // Should be a different signal (different source)
      expect(second.id).not.toBe(first.id);
      expect(second.source).toBe('google-trends-rss');
    });

    it('allows same title in different day window', async () => {
      const now = Date.now();
      const dayWindowMs = 24 * 60 * 60 * 1000;
      const yesterdayStart = Math.floor((now - dayWindowMs) / dayWindowMs) * dayWindowMs;
      const todayStart = Math.floor(now / dayWindowMs) * dayWindowMs;

      // First signal with createdAt in yesterday's window
      const signal1 = makeSignal({
        title: 'Cross-day Signal',
        source: 'test-source',
        createdAt: yesterdayStart + 1000,
      });
      const first = expectOk(await store.upsertSignalDeduped(signal1));

      // Second signal with same title but createdAt in today's window
      const signal2 = makeSignal({
        id: 'different-id',
        title: 'Cross-day Signal',
        source: 'test-source',
        createdAt: todayStart + 1000,
      });
      const second = expectOk(await store.upsertSignalDeduped(signal2));

      // Should be different because day window is different
      expect(second.id).not.toBe(first.id);
    });

    it('updates existing signal data on duplicate', async () => {
      const signal = makeSignal({ title: 'Update Test', source: 'test-source', confidence: 0.5 });
      const first = expectOk(await store.upsertSignalDeduped(signal));

      const updated = makeSignal({ id: 'different-id', title: 'Update Test', source: 'test-source', confidence: 0.9, data: { updated: true } });
      const second = expectOk(await store.upsertSignalDeduped(updated));

      expect(second.id).toBe(first.id); // Same id
      expect(second.confidence).toBe(0.9); // Updated confidence
      expect(second.data).toEqual({ updated: true }); // Updated data
    });
  });

  describe('consumeSignals', () => {
    it('marks signals as consumed', async () => {
      const s1Value = expectOk(await store.createSignal(makeSignal({ id: 'c1' })));
      const s2Value = expectOk(await store.createSignal(makeSignal({ id: 'c2' })));

      const result = await store.consumeSignals('ws-test', [s1Value.id, s2Value.id]);
      expect(expectOk(result)).toBe(2);

      const fetched1 = expectOk(await store.getSignal(s1Value.id));
      const fetched2 = expectOk(await store.getSignal(s2Value.id));
      expect(fetched1!.consumed).toBe(true);
      expect(fetched2!.consumed).toBe(true);
    });

    it('returns 0 for empty ids array', async () => {
      const result = await store.consumeSignals('ws-test', []);
      expect(expectOk(result)).toBe(0);
    });

    it('only consumes signals from correct workspace', async () => {
      const s1Value = expectOk(await store.createSignal(makeSignal({ id: 'ws1-sig', workspaceId: 'ws-1' })));
      const s2Value = expectOk(await store.createSignal(makeSignal({ id: 'ws2-sig', workspaceId: 'ws-2' })));

      const result = await store.consumeSignals('ws-1', [s1Value.id, s2Value.id]);
      expect(expectOk(result)).toBe(1); // Only ws-1 signal consumed

      const fetched1 = expectOk(await store.getSignal(s1Value.id));
      const fetched2 = expectOk(await store.getSignal(s2Value.id));
      expect(fetched1!.consumed).toBe(true);
      expect(fetched2!.consumed).toBe(false);
    });
  });

  describe('deleteExpiredSignals', () => {
    it('deletes expired signals', async () => {
      const expired = makeSignal({ id: 'expired-1', expiresAt: Date.now() - 1000 });
      const active = makeSignal({ id: 'active-1', expiresAt: Date.now() + 10000 });
      await store.createSignal(expired);
      await store.createSignal(active);

      const result = await store.deleteExpiredSignals();
      expect(expectOk(result)).toBe(1);

      const fetched = expectOk(await store.listSignals({ workspaceId: 'ws-test', includeExpired: true }));
      expect(fetched.find(s => s.id === 'expired-1')).toBeUndefined();
      expect(fetched.find(s => s.id === 'active-1')).toBeDefined();
    });

    it('optionally filters by workspace', async () => {
      const expiredWs1 = makeSignal({ id: 'ws1-exp', workspaceId: 'ws-1', expiresAt: Date.now() - 1000 });
      const expiredWs2 = makeSignal({ id: 'ws2-exp', workspaceId: 'ws-2', expiresAt: Date.now() - 1000 });
      await store.createSignal(expiredWs1);
      await store.createSignal(expiredWs2);

      const result = await store.deleteExpiredSignals('ws-1');
      expect(expectOk(result)).toBe(1);

      const ws1List = expectOk(await store.listSignals({ workspaceId: 'ws-1', includeExpired: true }));
      const ws2List = expectOk(await store.listSignals({ workspaceId: 'ws-2', includeExpired: true }));
      expect(ws1List.find(s => s.id === 'ws1-exp')).toBeUndefined();
      expect(ws2List.find(s => s.id === 'ws2-exp')).toBeDefined();
    });
  });

  describe('countSignals', () => {
    beforeEach(async () => {
      await store.createSignal(makeSignal({ id: 'c-1', consumed: false }));
      await store.createSignal(makeSignal({ id: 'c-2', consumed: true }));
      await store.createSignal(makeSignal({ id: 'c-3', consumed: false }));
    });

    it('counts all signals for workspace', async () => {
      const result = await store.countSignals('ws-test');
      expect(expectOk(result)).toBe(3);
    });

    it('counts only unconsumed', async () => {
      const result = await store.countSignals('ws-test', false);
      expect(expectOk(result)).toBe(2);
    });

    it('counts only consumed', async () => {
      const result = await store.countSignals('ws-test', true);
      expect(expectOk(result)).toBe(1);
    });
  });
});