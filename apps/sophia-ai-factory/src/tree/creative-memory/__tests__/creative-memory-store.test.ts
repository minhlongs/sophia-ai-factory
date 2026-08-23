/**
 * Tests for the ICreativeMemoryStore adapter over tree/creative-memory.
 *
 * Mocks D1 at the boundary (vi.mock('@/seed/db/client')) so the adapter is
 * exercised without a real database. Persistence behaviour is delegated to
 * upsertMemory / deleteMemory — those are covered by types.test.ts; here we
 * verify the adapter's own contract: Result envelopes, soft-delete, scope
 * filtering, and deterministic token-bounded summarization.
 *
 * @module tree/creative-memory/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

import { CreativeMemoryStore } from '../creative-memory-store';
import type { MemoryQuery } from '@/seed/types/creative-economy';
import type { CreativeMemory, MemoryCategory } from '@/seed/types/creative-domain';

interface PreparedStmt {
  first?: unknown;
  run?: unknown;
  all?: unknown;
}

function buildDb(stmts: PreparedStmt[]) {
  let i = 0;
  return {
    prepare: vi.fn(() => {
      const stmt = stmts[i++];
      if (!stmt) throw new Error('No more prepared stmts mocked');
      return {
        bind: () => ({
          first: async () => stmt.first,
          run: async () => (typeof stmt.run === 'function' ? stmt.run() : stmt.run),
          all: async () => stmt.all ?? { results: [], meta: { changes: 0, duration: 1 } },
        }),
      };
    }),
  };
}

function stmt(opts: PreparedStmt = {}): PreparedStmt {
  return { first: opts.first, run: opts.run, all: opts.all };
}

function memoryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mem_test',
    workspace_id: 'ws_001',
    category: 'identity',
    key: 'brand_tone',
    value: JSON.stringify({ tone: 'professional' }),
    confidence: 'high',
    source: 'setup-wizard',
    evidence: JSON.stringify(['User selection']),
    scope: 'global',
    scope_id: null,
    version: 1,
    is_deleted: 0,
    created_at: 1000,
    updated_at: 1000,
    expires_at: null,
    ...overrides,
  };
}

const store = new CreativeMemoryStore();

const baseQuery = (overrides: Partial<MemoryQuery> = {}): MemoryQuery => ({
  workspaceId: 'ws_001',
  ...overrides,
});

describe('CreativeMemoryStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('get', () => {
    it('returns a memory by branded id', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: memoryRow({ id: 'mem_1' }) })]));
      const result = await store.get('mem_1' as never);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.id).toBe('mem_1');
    });

    it('returns failure when the row is missing', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: null })]));
      const result = await store.get('mem_missing' as never);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('not found');
    });

    it('returns failure when D1 is unavailable', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await store.get('mem_x' as never);
      expect(result.ok).toBe(false);
    });
  });

  describe('put', () => {
    it('inserts a new entry and returns a branded id', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          // upsertMemory: no existing row, then insert
          stmt({ first: null }),
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
        ]),
      );
      const result = await store.put({
        workspaceId: 'ws_001',
        category: 'identity',
        key: 'brand_tone',
        value: { tone: 'professional' },
        confidence: 'high',
        source: 'setup-wizard',
        evidence: JSON.stringify(['User selection']),
        scope: 'global',
        isDeleted: false,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(typeof result.value).toBe('string');
    });

    it('propagates D1 unavailability as failure', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await store.put({
        workspaceId: 'ws_001',
        category: 'identity',
        key: 'brand_tone',
        value: {},
        confidence: 'high',
        source: 'setup-wizard',
        evidence: JSON.stringify([]),
        scope: 'global',
        isDeleted: false,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('delete', () => {
    it('soft-deletes an existing entry', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: memoryRow({ id: 'mem_1' }) }), // exists check
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }), // delete
        ]),
      );
      const result = await store.delete('mem_1' as never);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(true);
    });

    it('returns true=false for a missing entry (idempotent)', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: null })]));
      const result = await store.delete('mem_missing' as never);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(false);
    });
  });

  describe('query', () => {
    it('returns matching entries with total count', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: [
                memoryRow({ id: 'mem_a', category: 'creative', key: 'style_a' }),
                memoryRow({ id: 'mem_b', category: 'creative', key: 'style_b' }),
              ],
              meta: { changes: 2, duration: 1 },
            },
          }),
        ]),
      );
      const result = await store.query(baseQuery({ category: 'creative' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entries).toHaveLength(2);
        expect(result.value.total).toBe(2);
        expect(result.value.entries[0].category).toBe('creative');
      }
    });

    it('returns an empty summary when nothing matches', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ all: { results: [], meta: { changes: 0, duration: 1 } } })]),
      );
      const result = await store.query(baseQuery({ category: 'business' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entries).toEqual([]);
        expect(result.value.total).toBe(0);
      }
    });

    it('respects the query limit', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: [memoryRow({ id: 'mem_a' })],
              meta: { changes: 1, duration: 1 },
            },
          }),
        ]),
      );
      const result = await store.query(baseQuery({ limit: 1 }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.entries).toHaveLength(1);
    });
  });

  describe('summarize', () => {
    it('produces a compact text block from matching entries', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: [
                memoryRow({
                  id: 'mem_a',
                  category: 'identity',
                  key: 'brand_tone',
                  value: JSON.stringify({ tone: 'professional' }),
                }),
              ],
              meta: { changes: 1, duration: 1 },
            },
          }),
        ]),
      );
      const result = await store.summarize(baseQuery(), 100);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('[identity/brand_tone]');
        expect(result.value).toContain('"tone":"professional"');
      }
    });

    it('truncates output to the token budget', async () => {
      const rows = Array.from({ length: 50 }, (_, i) =>
        memoryRow({
          id: `mem_${i}`,
          key: `k${i}`,
          value: JSON.stringify({ data: 'x'.repeat(200) }),
        }),
      );
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: { results: rows, meta: { changes: rows.length, duration: 1 } },
          }),
        ]),
      );
      // 10 tokens * 4 chars/token = 40 chars max
      const result = await store.summarize(baseQuery({ limit: 50 }), 10);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeLessThanOrEqual(41); // 40 chars + ellipsis
        expect(result.value.endsWith('…')).toBe(true);
      }
    });

    it('returns an empty string for a zero token budget', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            all: {
              results: [memoryRow({ id: 'mem_a' })],
              meta: { changes: 1, duration: 1 },
            },
          }),
        ]),
      );
      const result = await store.summarize(baseQuery(), 0);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('');
    });
  });

  describe('D1 unavailable', () => {
    it('query returns failure when D1 is null', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await store.query(baseQuery());
      expect(result.ok).toBe(false);
    });

    it('summarize returns failure when D1 is null', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const result = await store.summarize(baseQuery(), 100);
      expect(result.ok).toBe(false);
    });
  });
});