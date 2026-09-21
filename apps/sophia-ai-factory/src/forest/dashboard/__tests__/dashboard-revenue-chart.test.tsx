import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardRevenueChart } from '../dashboard-revenue-chart';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'revenueChart.title': 'Revenue Over Time',
      'revenueChart.subtitle': 'Total sales performance this quarter',
      'revenueChart.periods.7d': 'Last 7 Days',
      'revenueChart.periods.30d': 'Last 30 Days',
      'revenueChart.periods.6m': 'Last 6 Months',
      'revenueChart.periods.ytd': 'Year to Date',
      'revenueChart.emptyTitle': 'No Revenue Recorded',
      'revenueChart.emptyDesc': 'No transaction revenue recorded for this period.',
    };
    return translations[key] || key;
  },
}));

const SAMPLE_DATA = [
  { label: 'Mon', revenue: 4200, percentage: 44 },
  { label: 'Tue', revenue: 6500, percentage: 68 },
  { label: 'Wed', revenue: 4800, percentage: 50 },
  { label: 'Thu', revenue: 8900, percentage: 92 },
  { label: 'Fri', revenue: 7200, percentage: 75 },
  { label: 'Sat', revenue: 9600, percentage: 100 },
  { label: 'Sun', revenue: 6800, percentage: 70 },
];

describe('DashboardRevenueChart — Bottom-Up Financial Visualization', () => {
  it('renders bottom-up bars anchored strictly at baseline when data is provided', () => {
    render(<DashboardRevenueChart data={SAMPLE_DATA} />);

    const container = screen.getByTestId('chart-columns-container');
    expect(container.className).toContain('items-end');

    // All bars should have bottom-up height style and gradient fill
    const bars = document.querySelectorAll('[data-testid^="revenue-bar-"]');
    expect(bars.length).toBe(7);

    bars.forEach((bar) => {
      const height = (bar as HTMLElement).style.height;
      expect(height).toMatch(/^[0-9]+%$/);
      expect(bar.className).toContain('bg-gradient-to-t');
      expect(bar.className).not.toContain('inset-0'); // Inverted ceiling bug eliminated
    });
  });

  it('renders zero-mock empty state when data is empty or undefined', () => {
    render(<DashboardRevenueChart data={[]} />);

    expect(screen.getByTestId('chart-empty-state')).toBeDefined();
    expect(screen.getByText('No Revenue Recorded')).toBeDefined();
    expect(screen.getByText('$0')).toBeDefined();

    // Neutral trend badge
    const badge = screen.getByTestId('revenue-trend-badge');
    expect(badge.textContent).toContain('0.0%');
  });

  it('renders dynamic positive trend badge when revenue is present', () => {
    render(<DashboardRevenueChart data={SAMPLE_DATA} trend="up" trendPercentage="+18.4%" />);

    const badge = screen.getByTestId('revenue-trend-badge');
    expect(badge.textContent).toContain('+18.4%');
  });

  it('renders all 7 day axis labels strictly aligned with columns', () => {
    render(<DashboardRevenueChart data={SAMPLE_DATA} currentPeriod="7d" />);

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const day of weekdays) {
      expect(screen.getByText(day)).toBeDefined();
    }
  });

  it('renders time range selector with 7d, 30d, 6m, ytd options and updates active state', () => {
    const onPeriodChange = vi.fn();
    render(<DashboardRevenueChart onPeriodChange={onPeriodChange} />);

    expect(screen.getByTestId('period-selector-7d')).toBeDefined();
    expect(screen.getByTestId('period-selector-30d')).toBeDefined();
    expect(screen.getByTestId('period-selector-6m')).toBeDefined();
    expect(screen.getByTestId('period-selector-ytd')).toBeDefined();

    // Click 30D
    fireEvent.click(screen.getByTestId('period-selector-30d'));
    expect(onPeriodChange).toHaveBeenCalledWith('30d');
  });

  it('displays hover tooltips with formatted USD currency values', () => {
    render(<DashboardRevenueChart data={SAMPLE_DATA} currentPeriod="7d" />);

    const tooltips = screen.getAllByRole('tooltip');
    expect(tooltips.length).toBe(7);

    // Verify first tooltip displays currency formatting
    expect(tooltips[0].textContent).toContain('$4,200');
  });

  it('applies Obsidian Cyber-Glass container styling', () => {
    render(<DashboardRevenueChart />);

    const card = screen.getByTestId('revenue-chart-card');
    expect(card.className).toContain('bg-[#12141F]/85');
    expect(card.className).toContain('backdrop-blur-xl');
  });
});
