/**
 * Tests for aggregateRevenueAttribution — D1 aggregation logic.
 *
 * Uses vi.mock() with vi.hoisted() for mock refs inside factory functions.
 * Verifies: empty workspace, D1 unavailability, error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock refs (hoisted so factory can access without ordering issues) ─────────

const {
  mockGetD1,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockGetD1: vi.fn<() => unknown>(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    warn: mockLoggerWarn,
    error: mockLoggerError,
    info: vi.fn(),
  },
}));

// ── Helpers under test ───────────────────────────────────────────────────────

const { aggregateRevenueAttribution } = await import('../revenue-attribution');

describe('aggregateRevenueAttribution', () => {
  beforeEach(() => {
    mockGetD1.mockReset();
    mockLoggerWarn.mockReset();
    mockLoggerError.mockReset();
  });

  it('returns empty array when D1 is unavailable', async () => {
    mockGetD1.mockReturnValue(null);
    const result = await aggregateRevenueAttribution('ws-1');
    expect(result).toEqual([]);
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it('returns empty array when query throws', async () => {
    const db = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1 query error');
      }),
    };
    mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);
    const result = await aggregateRevenueAttribution('ws-1');
    expect(result).toEqual([]);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it('returns empty array for empty workspace (no rows)', async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [] }) }),
      }),
    };
    mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);
    const result = await aggregateRevenueAttribution('ws-empty');
    expect(result).toEqual([]);
  });

  it('returns mapped rows with correct roi calculation', async () => {
    const rows = [
      {
        content_project_id: 'cp-1', workspace_id: 'ws-1', content_asset_id: 'ca-1',
        channel: 'clickbank', network: 'clickbank', clicks: 10, conversions: 2,
        revenue_cents: 5000, cost_cents: 1000, attributed_at: 1000,
      },
      {
        content_project_id: 'cp-2', workspace_id: 'ws-1', content_asset_id: null,
        channel: 'direct', network: 'unknown', clicks: 0, conversions: 0,
        revenue_cents: 0, cost_cents: 0, attributed_at: 2000,
      },
    ];
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: rows }) }),
      }),
    };
    mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);
    const result = await aggregateRevenueAttribution('ws-1', { since: 500 });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      workspaceId: 'ws-1', contentProjectId: 'cp-1', contentAssetId: 'ca-1',
      channel: 'clickbank', network: 'clickbank', clicks: 10, conversions: 2,
      revenueCents: 5000, costCents: 1000, roi: 400, attributedAt: 1000,
    });
    expect(result[1]).toEqual({
      workspaceId: 'ws-1', contentProjectId: 'cp-2', contentAssetId: null,
      channel: 'direct', network: 'unknown', clicks: 0, conversions: 0,
      revenueCents: 0, costCents: 0, roi: 0, attributedAt: 2000,
    });
  });
});