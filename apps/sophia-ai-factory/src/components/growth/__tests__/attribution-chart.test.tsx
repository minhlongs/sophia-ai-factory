import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttributionChart } from '../attribution-chart';

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => `trans_${key}`;
    t.has = () => false;
    return t;
  }
}));

describe('AttributionChart', () => {
  it('renders empty state properly', () => {
    render(<AttributionChart data={[]} />);
    expect(screen.getByText('No data available')).toBeDefined();
  });

  it('renders chart data properly', () => {
    const mockData = [
      { date: '2026-10-01', revenue: 100, label: 'Test Label 1' },
      { date: '2026-10-02', revenue: 200, label: 'Test Label 2' },
    ];
    render(<AttributionChart data={mockData} />);

    expect(screen.getByText('2026-10-01 - Test Label 1')).toBeDefined();
    expect(screen.getByText('$100.00')).toBeDefined();
    expect(screen.getByText('2026-10-02 - Test Label 2')).toBeDefined();
    expect(screen.getByText('$200.00')).toBeDefined();

    // The progressbar div should be rendered
    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars.length).toBe(2);
    expect(progressbars[1].getAttribute('aria-valuenow')).toBe('200');
  });
});
