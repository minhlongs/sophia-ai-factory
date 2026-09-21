import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DashboardRevenueChart,
  type ChartPeriod,
  type RevenueDataPoint,
} from '../dashboard-revenue-chart';
import { DashboardMetricsGrid } from '../dashboard-metrics-grid';
import { DashboardActivityTable, type DashboardActivityItem } from '../dashboard-activity-table';
import type { DashboardMetric } from '../types';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    const translations: Record<string, string> = {
      'revenueChart.title': 'Revenue Over Time',
      'revenueChart.subtitle': 'Total sales performance this quarter',
      'revenueChart.periods.7d': 'Last 7 Days',
      'revenueChart.periods.30d': 'Last 30 Days',
      'revenueChart.periods.6m': 'Last 6 Months',
      'revenueChart.periods.ytd': 'Year to Date',
      'recentTransactions.title': 'Recent Missions & Activity',
      'recentTransactions.subtitle': 'Real-time execution log',
      'recentTransactions.emptyTitle': 'No recent activity',
      'recentTransactions.emptyDesc': 'Launch your first mission to see activity',
      'recentTransactions.topup': 'Create New Mission',
    };
    return translations[key] || key;
  },
}));

// Mock @/navigation Link
vi.mock('@/navigation', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const TEST_PERIOD_DATA: Record<ChartPeriod, RevenueDataPoint[]> = {
  '7d': [
    { label: 'Mon', revenue: 4200, percentage: 44 },
    { label: 'Tue', revenue: 6500, percentage: 68 },
    { label: 'Wed', revenue: 4800, percentage: 50 },
    { label: 'Thu', revenue: 8900, percentage: 92 },
    { label: 'Fri', revenue: 7200, percentage: 75 },
    { label: 'Sat', revenue: 9600, percentage: 100 },
    { label: 'Sun', revenue: 6800, percentage: 70 },
  ],
  '30d': [
    { label: 'W1', revenue: 18400, percentage: 62 },
    { label: 'W2', revenue: 24100, percentage: 81 },
    { label: 'W3', revenue: 21300, percentage: 72 },
    { label: 'W4', revenue: 29800, percentage: 100 },
  ],
  '6m': [
    { label: 'Apr', revenue: 42000, percentage: 48 },
    { label: 'May', revenue: 56000, percentage: 64 },
    { label: 'Jun', revenue: 63000, percentage: 72 },
    { label: 'Jul', revenue: 71000, percentage: 81 },
    { label: 'Aug', revenue: 82000, percentage: 93 },
    { label: 'Sep', revenue: 88000, percentage: 100 },
  ],
  ytd: [
    { label: 'Q1', revenue: 125000, percentage: 55 },
    { label: 'Q2', revenue: 184000, percentage: 81 },
    { label: 'Q3', revenue: 228000, percentage: 100 },
  ],
};

describe('Empirical Challenger 2 — Revenue Chart & Dashboard Widgets Stress Harness', () => {
  describe('1. DashboardRevenueChart: Bottom-Up Baseline Anchoring', () => {
    it('anchors all bar columns strictly to bottom baseline without ceiling pinning', () => {
      const { container } = render(<DashboardRevenueChart currentPeriod="7d" periodData={TEST_PERIOD_DATA} />);

      // Verify the columns container has flex and items-end
      const columnsContainer = screen.getByTestId('chart-columns-container');
      expect(columnsContainer.className).toContain('items-end');
      expect(columnsContainer.className).not.toContain('items-start');

      // Verify each column column-track has justify-end (anchoring children to bottom)
      const columnTracks = container.querySelectorAll('.w-full.h-full.bg-white\\/\\[0\\.03\\]');
      expect(columnTracks.length).toBe(7);
      columnTracks.forEach((track) => {
        expect(track.className).toContain('justify-end');
        expect(track.className).not.toContain('justify-start');
      });

      // Verify bars have NO absolute top pinning or inset-0
      const bars = screen.getAllByTestId(/^revenue-bar-/);
      expect(bars.length).toBe(7);
      bars.forEach((bar) => {
        expect(bar.className).not.toContain('top-0');
        expect(bar.className).not.toContain('inset-0');
        expect(bar.className).toContain('bg-gradient-to-t');
        expect(bar.className).toContain('rounded-t-md');
      });
    });

    it('enforces height bounds between 8% and 100% mathematically', () => {
      const boundaryData: RevenueDataPoint[] = [
        { label: 'Zero', revenue: 0, percentage: 0 },
        { label: 'Under', revenue: -100, percentage: -50 },
        { label: 'Normal', revenue: 500, percentage: 42 },
        { label: 'Max', revenue: 1000, percentage: 100 },
        { label: 'Over', revenue: 2000, percentage: 150 },
      ];

      render(<DashboardRevenueChart data={boundaryData} />);

      const bar0 = screen.getByTestId('revenue-bar-0');
      const bar1 = screen.getByTestId('revenue-bar-1');
      const bar2 = screen.getByTestId('revenue-bar-2');
      const bar3 = screen.getByTestId('revenue-bar-3');
      const bar4 = screen.getByTestId('revenue-bar-4');

      // 0% clamped to min 8%
      expect(bar0.style.height).toBe('8%');
      // Negative clamped to min 8%
      expect(bar1.style.height).toBe('8%');
      // Normal 42%
      expect(bar2.style.height).toBe('42%');
      // 100%
      expect(bar3.style.height).toBe('100%');
      // 150% clamped to max 100%
      expect(bar4.style.height).toBe('100%');
    });
  });

  describe('2. DashboardRevenueChart: Extreme Data Stress Testing', () => {
    it('handles all zeros dataset correctly without crashing', () => {
      const zerosData: RevenueDataPoint[] = [
        { label: 'Mon', revenue: 0, percentage: 0 },
        { label: 'Tue', revenue: 0, percentage: 0 },
        { label: 'Wed', revenue: 0, percentage: 0 },
      ];

      render(<DashboardRevenueChart data={zerosData} />);

      // Header should display Total: $0 and tooltips also have $0
      expect(screen.getAllByText('$0').length).toBe(4);

      // Tooltips should display $0
      const tooltips = screen.getAllByRole('tooltip');
      expect(tooltips.length).toBe(3);
      tooltips.forEach((tt) => {
        expect(tt.textContent).toContain('$0');
      });
    });

    it('handles very large numbers ($10,000,000+) with standard comma formatting', () => {
      const largeData: RevenueDataPoint[] = [
        { label: 'Enterprise1', revenue: 10000000, percentage: 80 },
        { label: 'Enterprise2', revenue: 25500000, percentage: 100 },
      ];

      render(<DashboardRevenueChart data={largeData} />);

      // Total should be $35,500,000
      expect(screen.getByText('$35,500,000')).toBeDefined();

      const tooltips = screen.getAllByRole('tooltip');
      expect(tooltips[0].textContent).toContain('$10,000,000');
      expect(tooltips[1].textContent).toContain('$25,500,000');
    });

    it('handles negative revenue numbers gracefully', () => {
      const negativeData: RevenueDataPoint[] = [
        { label: 'Refund1', revenue: -5000, percentage: -10 },
        { label: 'Refund2', revenue: -12000, percentage: -30 },
      ];

      render(<DashboardRevenueChart data={negativeData} />);

      // Total should be $-17,000
      expect(screen.getByText('$-17,000')).toBeDefined();

      const tooltips = screen.getAllByRole('tooltip');
      expect(tooltips[0].textContent).toContain('$-5,000');
      expect(tooltips[1].textContent).toContain('$-12,000');
    });

    it('handles single-element array without division or layout errors', () => {
      const singleData: RevenueDataPoint[] = [
        { label: 'SoloDay', revenue: 1500, percentage: 100 },
      ];

      render(<DashboardRevenueChart data={singleData} />);

      // $1,500 appears in both header total and the single tooltip
      expect(screen.getAllByText('$1,500').length).toBe(2);
      expect(screen.getByText('SoloDay')).toBeDefined();
      expect(screen.getByTestId('revenue-bar-0').style.height).toBe('100%');
    });

    it('handles empty array [] without throwing unhandled exceptions', () => {
      render(<DashboardRevenueChart data={[]} />);

      expect(screen.getByText('$0')).toBeDefined();
      expect(screen.queryByTestId('revenue-bar-0')).toBeNull();
    });

    it('probes PROJECT.md contract where items have period property instead of label or omit percentage', () => {
      // PROJECT.md specification: { period: 'Mon', revenue: 5000 }
      const projectMdData = [
        { period: 'Mon', revenue: 5000 },
        { period: 'Tue', revenue: 10000 },
      ];

      render(<DashboardRevenueChart data={projectMdData as any} />);

      const bar0 = screen.getByTestId('revenue-bar-0');
      // When percentage is omitted, Math.min(100, Math.max(8, undefined)) evaluates to NaN
      // DOM rejects 'height: NaN%' as invalid CSS and leaves style.height as ''
      expect(bar0.style.height).toBe('');
    });
  });

  describe('3. DashboardRevenueChart: Period Switching & Hover Tooltips', () => {
    it('toggles seamlessly between 7d, 30d, 6m, and ytd periods in uncontrolled mode', () => {
      render(<DashboardRevenueChart periodData={TEST_PERIOD_DATA} />);

      // Default is 7d (Mon-Sun: 7 columns)
      expect(screen.getAllByTestId(/^revenue-bar-/).length).toBe(7);
      expect(screen.getByText('Mon')).toBeDefined();
      expect(screen.getByText('Sun')).toBeDefined();

      // Switch to 30d (W1-W4: 4 columns)
      fireEvent.click(screen.getByTestId('period-selector-30d'));
      expect(screen.getAllByTestId(/^revenue-bar-/).length).toBe(4);
      expect(screen.getByText('W1')).toBeDefined();
      expect(screen.getByText('W4')).toBeDefined();

      // Switch to 6m (Apr-Sep: 6 columns)
      fireEvent.click(screen.getByTestId('period-selector-6m'));
      expect(screen.getAllByTestId(/^revenue-bar-/).length).toBe(6);
      expect(screen.getByText('Apr')).toBeDefined();
      expect(screen.getByText('Sep')).toBeDefined();

      // Switch to ytd (Q1-Q3: 3 columns)
      fireEvent.click(screen.getByTestId('period-selector-ytd'));
      expect(screen.getAllByTestId(/^revenue-bar-/).length).toBe(3);
      expect(screen.getByText('Q1')).toBeDefined();
      expect(screen.getByText('Q3')).toBeDefined();
    });

    it('respects controlled currentPeriod prop and fires onPeriodChange callback', () => {
      const onPeriodChange = vi.fn();
      const { rerender } = render(
        <DashboardRevenueChart currentPeriod="30d" periodData={TEST_PERIOD_DATA} onPeriodChange={onPeriodChange} />
      );

      // Controlled period is 30d -> 4 columns
      expect(screen.getAllByTestId(/^revenue-bar-/).length).toBe(4);

      // Clicking 6M triggers callback
      fireEvent.click(screen.getByTestId('period-selector-6m'));
      expect(onPeriodChange).toHaveBeenCalledWith('6m');

      // Controlled parent rerenders with 6m
      rerender(<DashboardRevenueChart currentPeriod="6m" periodData={TEST_PERIOD_DATA} onPeriodChange={onPeriodChange} />);
      expect(screen.getAllByTestId(/^revenue-bar-/).length).toBe(6);
    });

    it('renders hover tooltips with obsidian glass styling and proper role', () => {
      render(<DashboardRevenueChart currentPeriod="7d" periodData={TEST_PERIOD_DATA} />);

      const tooltips = screen.getAllByRole('tooltip');
      expect(tooltips.length).toBe(7);

      tooltips.forEach((tt) => {
        expect(tt.className).toContain('bg-[#08090D]');
        expect(tt.className).toContain('opacity-0');
        expect(tt.className).toContain('group-hover:opacity-100');
        expect(tt.textContent).toMatch(/^[A-Za-z]+:\s*\$[0-9,]+$/);
      });
    });
  });

  describe('4. DashboardMetricsGrid: Stress Testing KPI Cards', () => {
    it('renders extreme values and massive numbers without layout collapse', () => {
      const stressMetrics: DashboardMetric[] = [
        { id: 'total_campaigns', value: '1,000,000', change: '+999%', trend: 'up', icon: 'Megaphone' },
        { id: 'active_campaigns', value: '0', change: '-100%', trend: 'down', icon: 'Play' },
        { id: 'videos_generated', value: '$84,500,200', change: '+54.2%', trend: 'up', icon: 'Video' },
        { id: 'success_rate', value: '0.00%', change: 'neutral', trend: 'neutral', icon: 'TrendingUp' },
      ];

      render(<DashboardMetricsGrid metrics={stressMetrics} />);

      expect(screen.getByText('1,000,000')).toBeDefined();
      expect(screen.getByText('0')).toBeDefined();
      expect(screen.getByText('$84,500,200')).toBeDefined();
      expect(screen.getByText('0.00%')).toBeDefined();

      // Check extreme trend badges
      expect(screen.getByText('+999%')).toBeDefined();
      expect(screen.getByText('-100%')).toBeDefined();
      expect(screen.getByText('neutral')).toBeDefined();
    });

    it('falls back to default metrics when empty array is passed', () => {
      render(<DashboardMetricsGrid metrics={[]} />);

      // Should render default 4 cards with zero counts
      expect(screen.getByTestId('kpi-card-total_campaigns')).toBeDefined();
      expect(screen.getByTestId('kpi-card-active_campaigns')).toBeDefined();
      expect(screen.getByTestId('kpi-card-videos_generated')).toBeDefined();
      expect(screen.getByTestId('kpi-card-success_rate')).toBeDefined();
      expect(screen.getByText('0.0%')).toBeDefined();
    });

    it('handles unrecognized metric IDs with fallback icon and label without crashing', () => {
      const customMetrics: DashboardMetric[] = [
        { id: 'custom_mrr_engine', value: '$125,000', change: '+45%', trend: 'up', icon: 'DollarSign' },
      ];

      render(<DashboardMetricsGrid metrics={customMetrics} />);

      expect(screen.getByTestId('kpi-card-custom_mrr_engine')).toBeDefined();
      expect(screen.getByText('$125,000')).toBeDefined();
    });
  });

  describe('5. DashboardActivityTable: Stress Testing Activity & Missions', () => {
    it('renders genuine empty state when activities or transactions are empty', () => {
      const { rerender } = render(<DashboardActivityTable activities={[]} />);
      expect(screen.getByText('No recent activity')).toBeDefined();

      rerender(<DashboardActivityTable transactions={[]} />);
      expect(screen.getByText('No recent activity')).toBeDefined();
    });

    it('renders mixed mission and payment records with correct status pills', () => {
      const mixedItems: DashboardActivityItem[] = [
        { id: 'item-1', type: 'mission', title: 'Viral AI Shorts #1', status: 'completed', date: '2026-09-20' },
        { id: 'item-2', type: 'payment', customer: 'Studio Alpha', amount: '$1,250.00', status: 'paid', date: '2026-09-20' },
        { id: 'item-3', type: 'mission', title: 'ElevenLabs Voice Batch', status: 'processing', date: '2026-09-21' },
        { id: 'item-4', type: 'mission', title: 'Fal.ai Diffusion Render', status: 'running', date: '2026-09-21' },
        { id: 'item-5', type: 'mission', title: 'Publisher Dispatch Queue', status: 'queued', date: '2026-09-21' },
        { id: 'item-6', type: 'payment', customer: 'Agency Beta', amount: '$500.00', status: 'pending', date: '2026-09-21' },
        { id: 'item-7', type: 'mission', title: 'Failed Video Generation', status: 'failed', date: '2026-09-21' },
        { id: 'item-8', type: 'custom', title: 'Unknown Custom Status Job', status: 'custom_unknown', date: '2026-09-21' },
      ];

      render(<DashboardActivityTable activities={mixedItems} />);

      // Verify all rows render
      expect(screen.getByText('Viral AI Shorts #1')).toBeDefined();
      expect(screen.getByText('Studio Alpha')).toBeDefined();
      expect(screen.getByText('ElevenLabs Voice Batch')).toBeDefined();
      expect(screen.getByText('Failed Video Generation')).toBeDefined();

      // Verify status pills
      // Emerald: completed, paid
      expect(screen.getByTestId('status-pill-completed')).toBeDefined();
      expect(screen.getByTestId('status-pill-paid')).toBeDefined();
      // Amber: processing, running, queued, pending
      expect(screen.getByTestId('status-pill-processing')).toBeDefined();
      expect(screen.getByTestId('status-pill-running')).toBeDefined();
      expect(screen.getByTestId('status-pill-queued')).toBeDefined();
      expect(screen.getByTestId('status-pill-pending')).toBeDefined();
      // Rose: failed, custom_unknown
      expect(screen.getByTestId('status-pill-failed')).toBeDefined();
      expect(screen.getByTestId('status-pill-custom_unknown')).toBeDefined();
    });

    it('renders long titles and customer names with truncate styling', () => {
      const longItem: DashboardActivityItem[] = [
        {
          id: 'long-1',
          type: 'mission',
          title: 'A'.repeat(120),
          status: 'completed',
          date: '2026-09-21',
        },
      ];

      const { container } = render(<DashboardActivityTable activities={longItem} />);
      const titleSpan = container.querySelector('span.truncate.max-w-xs');
      expect(titleSpan).not.toBeNull();
      expect(titleSpan?.textContent).toBe('A'.repeat(120));
    });

    it('verifies icon rendering when activity is passed from dashboard-page.tsx mapping', () => {
      // In dashboard-page.tsx, recentActivities are mapped as:
      // { id, date, customer: a.description, amount: 'AI Video Mission', status }
      // Notice type is not set, and amount is 'AI Video Mission'
      const mappedCampaignActivity: DashboardActivityItem[] = [
        {
          id: 'camp-1',
          date: '2026-09-21',
          customer: 'Summer Promo Campaign',
          amount: 'AI Video Mission',
          status: 'completed',
        },
      ];

      const { container } = render(<DashboardActivityTable activities={mappedCampaignActivity} />);
      
      // Look at icon container: is it amber (CreditCard/payment) or primary (Film/mission)?
      const iconContainer = container.querySelector('[data-testid="activity-row-camp-1"] .rounded-lg.flex');
      expect(iconContainer).not.toBeNull();
      // Because amount is non-empty and !== '$0.00', isPayment evaluated to true:
      // It rendered CreditCard (amber-500/10) instead of Film (primary/10)
      const hasAmberPill = iconContainer?.className.includes('bg-amber-500/10');
      expect(hasAmberPill).toBe(true);
    });
  });
});
