/**
 * Unit tests for learning-velocity.ts server action + velocity-math.ts.
 *
 * Covers: auth guard, validation, membership check, precomputed path,
 * fallback compute path, and drift-guard parity with forest's cron.
 *
 * @module land/creative-economy/__tests__/learning-velocity
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

import { getLearningVelocity } from '../learning-velocity';
import { computeVelocityScore, avgMetrics, parseMetrics } from '../velocity-math';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('getLearningVelocity', () => {
  it('returns VALIDATION_ERROR for empty workspaceId', async () => {
    const result = await getLearningVelocity({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_AUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getLearningVelocity({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns FORBIDDEN when user is not a workspace member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce(null);

    const result = await getLearningVelocity({ workspaceId: 'other-ws' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns precomputed velocity rows when table has data', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({}); // membership
    mockAll.mockResolvedValueOnce({
      results: [
        {
          entity_type: 'video',
          channel: 'youtube',
          velocity_score: 75,
          event_count: 20,
          window_start_ms: 1700000000000,
          window_end_ms: 1700604800000,
        },
      ],
    });

    const result = await getLearningVelocity({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].entityType).toBe('video');
      expect(result.value[0].velocityScore).toBe(75);
    }
  });

  it('falls back to computing velocity when table is empty', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({}); // membership
    mockAll
      .mockResolvedValueOnce({ results: [] }) // empty learning_velocity
      .mockResolvedValueOnce({
        results: [{ entity_type: 'video', channel: 'youtube' }],
      }) // combos
      .mockResolvedValueOnce({
        results: [
          { metrics_json: '{"views":100}' },
          { metrics_json: '{"views":120}' },
          { metrics_json: '{"views":150}' },
          { metrics_json: '{"views":200}' },
        ],
      }); // events

    const result = await getLearningVelocity({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].entityType).toBe('video');
      // Score should be > 50 since views are increasing
      expect(result.value[0].velocityScore).toBeGreaterThan(50);
    }
  });

  it('returns INTERNAL on unexpected database error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockRejectedValueOnce(new Error('D1 error'));

    const result = await getLearningVelocity({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
    }
  });
});

describe('velocity-math — drift guard parity with forest cron', () => {
  it('computeVelocityScore returns 50 for no data', () => {
    expect(computeVelocityScore({}, {})).toBe(50);
  });

  it('computeVelocityScore returns >50 for improvement', () => {
    const early = { views: 100 };
    const late = { views: 200 };
    expect(computeVelocityScore(early, late)).toBeGreaterThan(50);
  });

  it('computeVelocityScore returns <50 for regression', () => {
    const early = { views: 200 };
    const late = { views: 100 };
    expect(computeVelocityScore(early, late)).toBeLessThan(50);
  });

  it('computeVelocityScore returns 50 for identical metrics', () => {
    const data = { views: 100, ctr: 0.05 };
    expect(computeVelocityScore(data, data)).toBe(50);
  });

  it('parseMetrics extracts only numeric values', () => {
    const row = { metrics_json: '{"views":100,"label":"test","ctr":0.05}' };
    const result = parseMetrics(row);
    expect(result.views).toBe(100);
    expect(result.ctr).toBe(0.05);
    expect(result.label).toBeUndefined();
  });

  it('parseMetrics returns empty object for malformed JSON', () => {
    const row = { metrics_json: '{invalid}' };
    expect(parseMetrics(row)).toEqual({});
  });

  it('avgMetrics computes mean across rows', () => {
    const rows = [
      { metrics_json: '{"views":100}' },
      { metrics_json: '{"views":200}' },
    ];
    const result = avgMetrics(rows);
    expect(result.views).toBe(150);
  });
});

