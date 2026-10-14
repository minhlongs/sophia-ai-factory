// i18n-namespace: dashboard.analytics

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrossPlatformAnalyticsClient, MetricStatCards, COLORS } from './index';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('CrossPlatformAnalytics', () => {
  it('renders no_workspace notice when workspaceId is empty', () => {
    render(<CrossPlatformAnalyticsClient workspaceId="" />);
    expect(screen.getByText('no_workspace')).toBeDefined();
  });

  it('renders MetricStatCards with computed metrics', () => {
    const channels = [
      { channel: 'youtube', eventCount: 100, avgValueCents: 200 },
      { channel: 'tiktok', eventCount: 50, avgValueCents: 150 },
    ];
    const roi = [
      { channel: 'youtube', revenueCents: 1000, costCents: 500, roi: 100 },
    ];

    render(<MetricStatCards channels={channels} roi={roi} />);
    expect(screen.getByText('150')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('provides color palette constants', () => {
    expect(COLORS.length).toBeGreaterThan(0);
  });
});
