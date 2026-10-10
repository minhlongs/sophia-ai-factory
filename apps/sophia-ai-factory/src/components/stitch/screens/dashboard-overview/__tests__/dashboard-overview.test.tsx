import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DashboardOverview } from '../dashboard-overview';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('DashboardOverview', () => {
  it('renders without crashing with default props', () => {
    render(<DashboardOverview />);
    expect(screen.getByText('quickActions.title')).toBeDefined();
  });

  it('renders custom metrics and campaigns when passed', () => {
    const customMetrics = [
      {
        id: 'activeCampaigns',
        label: 'Active Campaigns',
        value: '99',
        change: '+42%',
        isPositive: true,
      },
    ];
    render(<DashboardOverview kpiMetrics={customMetrics} />);
    expect(screen.getByText('99')).toBeDefined();
  });
});
