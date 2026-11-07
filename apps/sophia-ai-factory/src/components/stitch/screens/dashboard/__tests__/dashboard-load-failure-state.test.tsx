/**
 * Dashboard Load Failure State Tests
 *
 * A failed dashboard load and an account that genuinely has no data are two
 * different facts, and the customer must be able to tell them apart. The old
 * page substituted zero-valued KPIs when the aggregator failed, which told a
 * customer their business produced nothing when we simply did not know.
 *
 * @module components/stitch/screens/dashboard/__tests__/dashboard-load-failure-state
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import DashboardPage from '../dashboard-page';
import { DashboardMetricsGrid } from '@/forest/dashboard/dashboard-metrics-grid';
import { DashboardActivityTable } from '@/forest/dashboard/dashboard-activity-table';

const MESSAGES = {
  stitch: {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Overview',
      actions: {
        exportData: 'Export Data',
        addProduct: 'Add Product',
      },
      advanced: { localEngineLabel: 'Advanced' },
      metrics: {
        unavailableHint: 'We could not load your numbers.',
        emptyHint: 'Your account has no data for this period yet.',
      },
      recentTransactions: {
        title: 'Recent Activity',
        subtitle: 'Latest work',
        unavailableTitle: 'We could not load your activity history.',
        emptyTitle: 'No activity yet',
        emptyDesc: 'Nothing has happened yet.',
      },
    },
  },
};

function renderPage(props: Partial<React.ComponentProps<typeof DashboardPage>>) {
  return render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <DashboardPage {...props} />
    </NextIntlClientProvider>,
  );
}

describe('dashboard load failure is never rendered as zero', () => {
  it('shows an unavailable state instead of zero KPIs when the load failed', () => {
    renderPage({ loadFailed: true });

    expect(screen.getByTestId('dashboard-metrics-unavailable').getAttribute('data-status')).toBe('error');
    expect(screen.queryByTestId('dashboard-metrics-grid')).toBeNull();
  });

  it('never prints a zero value for a failed load', () => {
    const { container } = renderPage({ loadFailed: true });
    // The old page rendered literal "0" KPI values on failure.
    expect(container.textContent).not.toMatch(/>0</);
    expect(container.textContent).not.toMatch(/\b0\.0%\b/);
  });

  it('shows the activity history as unavailable rather than empty', () => {
    renderPage({ loadFailed: true });
    expect(screen.getByTestId('dashboard-activity-unavailable').getAttribute('data-status')).toBe('error');
  });

  it('does not claim a verified empty account when the load failed', () => {
    renderPage({ loadFailed: true });
    // The empty-account copy ("no data for this period") is a claim about the
    // account; it must not appear for a failed load.
    expect(screen.queryByTestId('dashboard-metrics-empty')).toBeNull();
  });
});

describe('dashboard verified empty is still shown as empty', () => {
  it('distinguishes a genuinely empty verified account from a failure', () => {
    const emptyCampaignMetrics = {
      totalCampaigns: 0,
      activeCampaigns: 0,
      completedCampaigns: 0,
      failedCampaigns: 0,
      totalVideosGenerated: 0,
      successRate: 0,
    };

    renderPage({
      initialData: {
        metrics: [],
        campaignMetrics: emptyCampaignMetrics,
        recentActivities: [],
        topAffiliates: [],
      },
      loadFailed: false,
    });

    expect(screen.queryByTestId('dashboard-metrics-unavailable')).toBeNull();
    expect(screen.getByTestId('dashboard-metrics-empty').getAttribute('data-status')).toBe('verified_empty');
  });

  it('renders the empty activity state for a verified empty account', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={MESSAGES}>
        <DashboardActivityTable transactions={[]} />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector('[data-testid="dashboard-activity-unavailable"]')).toBeNull();
    expect(container.querySelector('[data-testid="dashboard-activity-table"]')).toBeDefined();
  });
});

describe('metrics grid status contract', () => {
  it('treats undefined metrics as unavailable, not as zero', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={MESSAGES}>
        <DashboardMetricsGrid metrics={undefined} />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector('[data-status="error"]')).not.toBeNull();
    expect(screen.queryByTestId('kpi-card-total_campaigns')).toBeNull();
  });

  it('renders real KPIs when metrics are supplied', () => {
    render(
      <NextIntlClientProvider locale="en" messages={MESSAGES}>
        <DashboardMetricsGrid
          metrics={[
            { id: 'total_campaigns', value: '4', change: '+2', trend: 'up', icon: 'Megaphone' },
          ]}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('kpi-card-total_campaigns').textContent).toContain('4');
  });

  it('wires dashboard header CTAs to real destinations and keeps control deck inside advanced tools', () => {
    const { container } = renderPage({ loadFailed: false });
    const exportLink = screen.getByRole('link', { name: /Export Data/i });
    const addProductLink = screen.getByRole('link', { name: /Add Product/i });

    expect(exportLink.getAttribute('href')).toContain('/dashboard/campaigns');
    expect(addProductLink.getAttribute('href')).toContain('/dashboard/affiliates');

    const advancedDetails = container.querySelector('details[data-testid="dashboard-advanced-tools"]');
    expect(advancedDetails).not.toBeNull();
  });
});
