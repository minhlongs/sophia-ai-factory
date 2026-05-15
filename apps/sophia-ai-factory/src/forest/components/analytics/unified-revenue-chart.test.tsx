/**
 * Smoke tests for UnifiedRevenueChart component.
 *
 * Verifies: mounts without crash, renders skeleton on load,
 * renders chart after successful fetch.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { UnifiedRevenueSummary } from '@/lib/analytics/queries/revenue-unified-query';

// ── Mock next-intl (not needed by this component, but may be in deps) ─────────
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// ── Mock recharts to avoid canvas errors in jsdom ─────────────────────────────
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
}));

// ── Stub fetch ────────────────────────────────────────────────────────────────

const MOCK_DATA: UnifiedRevenueSummary = {
  totalThisMonth: 1250.5,
  byVertical: { saas: 800, crypto: 200, product: 250.5 },
  dailySeries: [
    { date: '2026-05-01', saas: 80, crypto: 20, product: 25, total: 125 },
    { date: '2026-05-02', saas: 80, crypto: 20, product: 25, total: 125 },
  ],
  periodDays: 30,
};

describe('UnifiedRevenueChart', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders without crashing', async () => {
    const { UnifiedRevenueChart } = await import('./unified-revenue-chart');
    const { container } = render(<UnifiedRevenueChart />);
    expect(container).toBeTruthy();
  });

  it('shows skeleton while loading', async () => {
    // Delay fetch so loading state is visible
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { UnifiedRevenueChart } = await import('./unified-revenue-chart');
    render(<UnifiedRevenueChart />);
    // Skeleton renders when loading
    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders chart with data after successful fetch', async () => {
    vi.resetModules();
    const { UnifiedRevenueChart } = await import('./unified-revenue-chart');
    render(<UnifiedRevenueChart />);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeTruthy();
    });
  });

  it('renders total revenue headline after data loads', async () => {
    vi.resetModules();
    const { UnifiedRevenueChart } = await import('./unified-revenue-chart');
    render(<UnifiedRevenueChart />);

    await waitFor(() => {
      // Total headline: "$1,250.50" or similar
      expect(screen.getByText(/1[,.]?250/)).toBeTruthy();
    });
  });

  it('shows error message when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    vi.resetModules();
    const { UnifiedRevenueChart } = await import('./unified-revenue-chart');
    render(<UnifiedRevenueChart />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeTruthy();
    });
  });
});
