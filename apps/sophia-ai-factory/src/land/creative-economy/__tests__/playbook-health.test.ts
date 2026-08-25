/**
 * Unit tests for playbook-health.ts server action.
 *
 * Covers: auth guard, validation, membership check (cross-tenant),
 * happy path with healthy status, at_risk detection, rolled_back detection,
 * empty installs, and internal error handling.
 *
 * @module land/creative-economy/__tests__/playbook-health
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

import { getPlaybookHealth } from '../playbook-health';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('getPlaybookHealth', () => {
  it('returns VALIDATION_ERROR for empty workspaceId', async () => {
    const result = await getPlaybookHealth({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_AUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getPlaybookHealth({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns FORBIDDEN when user is not a workspace member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce(null);

    const result = await getPlaybookHealth({ workspaceId: 'other-ws' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns empty array when no playbook installs exist', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({}); // membership
    mockAll.mockResolvedValueOnce({ results: [] }); // no installs

    const result = await getPlaybookHealth({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('returns healthy status when recent failure rate is low', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({}); // membership
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'inst-001',
          config_values: JSON.stringify({ source: 'playbook', autoApply: 1, ruleId: 'rule-1' }),
        },
      ],
    });
    // recent query: low failure rate
    mockFirst.mockResolvedValueOnce({ total: 10, failed: 1 });
    // baseline query: similar rate
    mockFirst.mockResolvedValueOnce({ total: 10, failed: 1 });

    const result = await getPlaybookHealth({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].status).toBe('healthy');
      expect(result.value[0].installationId).toBe('inst-001');
    }
  });

  it('returns at_risk status when recent failure rate spikes', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'inst-002',
          config_values: JSON.stringify({ source: 'playbook', autoApply: 1, ruleId: 'rule-2' }),
        },
      ],
    });
    // recent: high failure rate (80%)
    mockFirst.mockResolvedValueOnce({ total: 10, failed: 8 });
    // baseline: low failure rate (10%)
    mockFirst.mockResolvedValueOnce({ total: 10, failed: 1 });

    const result = await getPlaybookHealth({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].status).toBe('at_risk');
    }
  });

  it('returns rolled_back status when autoApply is disabled after spike', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({});
    // Rolled-back installs keep their row with autoApply = 0 in config_values
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'inst-003',
          config_values: JSON.stringify({ source: 'playbook', autoApply: 0, ruleId: 'rule-3' }),
        },
      ],
    });
    // recent: high failure rate
    mockFirst.mockResolvedValueOnce({ total: 10, failed: 8 });
    // baseline: low
    mockFirst.mockResolvedValueOnce({ total: 10, failed: 1 });

    const result = await getPlaybookHealth({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].status).toBe('rolled_back');
    }
  });

  it('returns INTERNAL on unexpected database error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockRejectedValueOnce(new Error('D1 error'));

    const result = await getPlaybookHealth({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
    }
  });
});

