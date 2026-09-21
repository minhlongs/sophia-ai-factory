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
    };
    return translations[key] || key;
  },
}));

describe('DashboardRevenueChart — Bottom-Up Financial Visualization', () => {
  it('renders bottom-up bars anchored strictly at baseline', () => {
    render(<DashboardRevenueChart />);

    const container = screen.getByTestId('chart-columns-container');
    expect(container.className).toContain('items-end');

    // All bars should have bottom-up height style and gradient fill
    const bars = document.querySelectorAll('[data-testid^="revenue-bar-"]');
    expect(bars.length).toBeGreaterThanOrEqual(4);

    bars.forEach((bar) => {
      const height = (bar as HTMLElement).style.height;
      expect(height).toMatch(/^[0-9]+%$/);
      expect(bar.className).toContain('bg-gradient-to-t');
      expect(bar.className).not.toContain('inset-0'); // Inverted ceiling bug eliminated
    });
  });

  it('renders all 7 day axis labels strictly aligned with columns', () => {
    render(<DashboardRevenueChart currentPeriod="7d" />);

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
    render(<DashboardRevenueChart currentPeriod="7d" />);

    const tooltips = screen.getAllByRole('tooltip');
    expect(tooltips.length).toBe(7);

    // Verify first tooltip displays currency formatting
    expect(tooltips[0].textContent).toContain('$');
  });

  it('applies Obsidian Cyber-Glass container styling', () => {
    render(<DashboardRevenueChart />);

    const card = screen.getByTestId('revenue-chart-card');
    expect(card.className).toContain('bg-[#12141F]/85');
    expect(card.className).toContain('backdrop-blur-xl');
  });
});
