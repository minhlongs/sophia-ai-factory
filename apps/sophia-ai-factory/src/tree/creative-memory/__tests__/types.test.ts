/**
 * Tests for tree/creative-memory versioned memory (Sophia 2027 Phase 1).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

import {
  upsertMemory,
  getMemory,
  getMemoryByCategory,
  recordLearning,
} from '../types';
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

describe('tree/creative-memory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('upsertMemory', () => {
    it('inserts new memory with version 1', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: null }), // no existing
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
        ]),
      );

      const entry: CreativeMemory = {
        id: '',
        workspaceId: 'ws_001',
        category: 'identity',
        key: 'brand_tone',
        value: { tone: 'professional' },
        confidence: 'high',
        source: 'setup-wizard',
        evidence: JSON.stringify(['User selection']),
        scope: 'global',
        scopeId: undefined,
        version: 0,
        isDeleted: false,
        createdAt: 0,
        updatedAt: 0,
      };

      const result = await upsertMemory(entry);
      expect(result.version).toBe(1);
      expect(result.confidence).toBe('high');
    });

    it('increments version on existing memory', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: { id: 'mem_old', version: 2 } }),
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
          stmt({ first: { id: 'mem_old', version: 3 } }),
        ]),
      );

      const entry: CreativeMemory = {
        id: 'mem_old',
        workspaceId: 'ws_001',
        category: 'identity',
        key: 'brand_tone',
        value: { tone: 'warm' },
        confidence: 'high',
        source: 'setup-wizard',
        evidence: JSON.stringify(['User selection']),
        scope: 'global',
        scopeId: undefined,
        version: 0,
        isDeleted: false,
        createdAt: 0,
        updatedAt: 0,
      };

      const result = await upsertMemory(entry);
      expect(result.version).toBe(3);
    });

    it('throws when db is null', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const entry: CreativeMemory = {
        id: '',
        workspaceId: 'ws_001',
        category: 'identity',
        key: 'brand_tone',
        value: {},
        confidence: 'high',
        source: 'setup-wizard',
        evidence: JSON.stringify([]),
        scope: 'global',
        scopeId: undefined,
        version: 0,
        isDeleted: false,
        createdAt: 0,
        updatedAt: 0,
      };
      await expect(upsertMemory(entry)).rejects.toThrow('D1 not available');
    });
  });

  describe('getMemory', () => {
    it('returns memory by workspace+category+key', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            first: {
              ...memoryRow({ id: 'mem_exact', value: JSON.stringify({ tone: 'professional' }) }),
            },
          }),
        ]),
      );

      const result = await getMemory('ws_001', 'identity', 'brand_tone');
      expect(result).toBeDefined();
      expect(result!.id).toBe('mem_exact');
      expect(result!.key).toBe('brand_tone');
      expect(result!.value).toEqual({ tone: 'professional' });
    });

    it('returns null when not found', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: null })]));
      const result = await getMemory('ws_001', 'identity', 'nonexistent_key');
      expect(result).toBeNull();
    });
  });

  describe('getMemoryByCategory', () => {
    it('returns all memories for a workspace + category', async () => {
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

      const result = await getMemoryByCategory('ws_001', 'creative');
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('creative');
    });

    it('returns empty array when no memories exist', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ all: { results: [], meta: { changes: 0, duration: 1 } } })]),
      );
      const result = await getMemoryByCategory('ws_001', 'identity');
      expect(result).toEqual([]);
    });
  });

  describe('recordLearning', () => {
    it('delegates to upsertMemory with performance source', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: null }), // upsertMemory: no existing
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
        ]),
      );

      const result = await recordLearning(
        'ws_001',
        'performance',
        'ctr_rate',
        { rate: 0.15 },
        'A/B test result: ctr improved 15%',
      );

      // recordLearning hardcodes source='performance' and confidence='medium'
      expect(result.source).toBe('performance');
      expect(result.confidence).toBe('medium');
      expect(result.value).toEqual({ rate: 0.15 });
    });
  });
});