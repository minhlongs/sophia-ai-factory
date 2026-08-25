/**
 * Unit tests for memory-insights.ts server action.
 *
 * Covers: auth guard, validation, membership check (cross-tenant),
 * happy path with JSON value parsing, malformed JSON fallback,
 * and internal error handling.
 *
 * @module land/creative-economy/__tests__/memory-insights
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockPrepare = vi.fn().mockReturnThis();
const mockBind = vi.fn().mockReturnThis();
const mockFirst = vi.fn();
const mockAll = vi.fn();

const fakeDb = {
  prepare: mockPrepare,
  bind: mockBind,
  first: mockFirst,
  all: mockAll,
  run: vi.fn(),
  execute: vi.fn(),
};

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => fakeDb,
}));

import { getCreativeMemory } from '../memory-insights';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('getCreativeMemory', () => {
  it('returns VALIDATION_ERROR for empty workspaceId', async () => {
    const result = await getCreativeMemory({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_AUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getCreativeMemory({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns FORBIDDEN when user is not a workspace member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce(null);

    const result = await getCreativeMemory({ workspaceId: 'other-ws' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns success with parsed memory entries', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'mem-001',
          category: 'strategy',
          key: 'hook-pattern',
          value: JSON.stringify({ title: 'Hook Pattern', summary: 'Use curiosity gap' }),
          confidence: 'high',
          created_at: 1700000000000,
        },
      ],
    });

    const result = await getCreativeMemory({ workspaceId: 'ws-1', limit: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      const mem = result.value[0];
      expect(mem.id).toBe('mem-001');
      expect(mem.title).toBe('Hook Pattern');
      expect(mem.summary).toBe('Use curiosity gap');
      expect(mem.confidence).toBe('high');
      expect(mem.createdAtMs).toBe(1700000000000);
    }
  });

  it('handles malformed JSON value gracefully with fallback', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'mem-002',
          category: 'learning',
          key: 'broken-entry',
          value: '{invalid json}',
          confidence: 'medium',
          created_at: 1700000001000,
        },
      ],
    });

    const result = await getCreativeMemory({ workspaceId: 'ws-1', limit: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const mem = result.value[0];
      expect(mem.title).toBe('broken-entry');
      expect(mem.summary).toBe('{invalid json}');
    }
  });

  it('returns empty array when no memory entries exist', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockAll.mockResolvedValueOnce({ results: [] });

    const result = await getCreativeMemory({ workspaceId: 'ws-1', limit: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('returns INTERNAL on unexpected database error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockRejectedValueOnce(new Error('D1 error'));

    const result = await getCreativeMemory({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
    }
  });
});

