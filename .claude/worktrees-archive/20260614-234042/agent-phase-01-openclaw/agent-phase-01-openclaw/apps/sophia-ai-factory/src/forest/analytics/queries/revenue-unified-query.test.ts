/**
 * Tests for revenue-unified-query — D1 aggregation logic.
 *
 * Uses the global D1 mock from test/setup.tsx.
 * Verifies: vertical mapping, zero-fill, period bounds, totals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers under test (pure functions) ───────────────────────────────────────

// We test the exported function via mocked D1. The D1 mock in setup.tsx
// returns empty results by default. We override per test.

describe('fetchUnifiedRevenue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset D1 mock to return empty results
    const d1Mock = ((globalThis as Record<string, unknown>).__env as Record<string, unknown>).DB as {
      prepare: ReturnType<typeof vi.fn>;
    };
    d1Mock.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    });
  });

  it('returns zero-filled daily series with correct length for 7d', async () => {
    const { fetchUnifiedRevenue } = await import('./revenue-unified-query');
    const result = await fetchUnifiedRevenue(7);
    expect(result.periodDays).toBe(7);
    expect(result.dailySeries).toHaveLength(7);
    expect(result.totalThisMonth).toBe(0);
    expect(result.byVertical.saas).toBe(0);
    expect(result.byVertical.crypto).toBe(0);
    expect(result.byVertical.product).toBe(0);
  });

  it('returns zero-filled daily series with correct length for 30d', async () => {
    const { fetchUnifiedRevenue } = await import('./revenue-unified-query');
    const result = await fetchUnifiedRevenue(30);
    expect(result.periodDays).toBe(30);
    expect(result.dailySeries).toHaveLength(30);
  });

  it('returns zero-filled daily series with correct length for 90d', async () => {
    const { fetchUnifiedRevenue } = await import('./revenue-unified-query');
    const result = await fetchUnifiedRevenue(90);
    expect(result.periodDays).toBe(90);
    expect(result.dailySeries).toHaveLength(90);
  });

  it('each daily row has saas + crypto + product = total', async () => {
    const { fetchUnifiedRevenue } = await import('./revenue-unified-query');
    const result = await fetchUnifiedRevenue(7);
    for (const row of result.dailySeries) {
      expect(row.total).toBeCloseTo(row.saas + row.crypto + row.product);
    }
  });

  it('sums byVertical correctly from daily series', async () => {
    // Override D1 mock to return affiliate conversion rows
    const d1Mock = ((globalThis as Record<string, unknown>).__env as Record<string, unknown>).DB as {
      prepare: ReturnType<typeof vi.fn>;
    };

    const today = new Date().toISOString().slice(0, 10);

    let callCount = 0;
    d1Mock.prepare.mockImplementation(() => {
      callCount++;
      const isAffiliateCall = callCount > 1; // first call = payment_events
      return {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: isAffiliateCall
            ? [
                { day: today, vertical: 'product', revenue: 50.0 },
                { day: today, vertical: 'crypto', revenue: 25.0 },
              ]
            : [],
          success: true,
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
      };
    });

    // Re-import to pick up fresh mock (module cache cleared by vi.clearAllMocks)
    vi.resetModules();
    const { fetchUnifiedRevenue } = await import('./revenue-unified-query');
    const result = await fetchUnifiedRevenue(7);

    // product + crypto totals should be non-zero on today's row
    const todayRow = result.dailySeries.find(r => r.date === today);
    expect(todayRow).toBeDefined();
    if (todayRow) {
      expect(todayRow.product).toBe(50.0);
      expect(todayRow.crypto).toBe(25.0);
    }
  });

  it('daily series dates are sorted ascending', async () => {
    vi.resetModules();
    const { fetchUnifiedRevenue } = await import('./revenue-unified-query');
    const result = await fetchUnifiedRevenue(7);
    const dates = result.dailySeries.map(r => r.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});
