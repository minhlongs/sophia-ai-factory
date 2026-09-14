import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardOnboardingBanner } from '../dashboard-onboarding-banner';
import { DashboardAffiliatesCard } from '../dashboard-affiliates-card';
import { DashboardTransactionsCard } from '../dashboard-transactions-card';
import { DashboardMetricsGrid } from '../dashboard-metrics-grid';
import { DashboardRevenueChart } from '../dashboard-revenue-chart';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
}));

// Mock @/navigation Link
vi.mock('@/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('Dashboard Subcomponents', () => {
  describe('DashboardOnboardingBanner', () => {
    it('renders setup wizard CTA when not fully configured', () => {
      render(
        <DashboardOnboardingBanner
          readiness={{
            ownerVerified: true,
            byokEncrypted: false,
            providersConfigured: [],
            providersReady: [],
            subscriptionActive: true,
            tier: 'BASIC',
            mcuBalance: 100,
            capabilities: [],
            readyForMissions: false,
            issues: ['No BYOK providers configured'],
          }}
        />
      );

      expect(screen.getByText('title')).toBeDefined();
      expect(screen.getByText('cta')).toBeDefined();
      expect(screen.getByText('healthCheck')).toBeDefined();
    });

    it('renders ready banner when all systems operational and providers configured', () => {
      render(
        <DashboardOnboardingBanner
          readiness={{
            ownerVerified: true,
            byokEncrypted: true,
            providersConfigured: ['openrouter'],
            providersReady: ['openrouter'],
            subscriptionActive: true,
            tier: 'ENTERPRISE',
            mcuBalance: 1000,
            capabilities: [],
            readyForMissions: true,
            issues: [],
          }}
        />
      );

      expect(screen.getByText('ready')).toBeDefined();
      expect(screen.getByText('healthCheck')).toBeDefined();
    });
  });

  describe('DashboardAffiliatesCard — Data Truth (Rules 14 & 15)', () => {
    it('renders genuine empty state without fake customers when affiliates array is empty', () => {
      render(<DashboardAffiliatesCard affiliates={[]} />);

      expect(screen.getByText('topAffiliates.emptyTitle')).toBeDefined();
      expect(screen.getByText('topAffiliates.emptyDesc')).toBeDefined();
      expect(screen.getByText('topAffiliates.discover')).toBeDefined();
      expect(screen.queryByText('Sarah Jenkins')).toBeNull();
      expect(screen.queryByText('Mark Thompson')).toBeNull();
    });

    it('renders affiliate items when genuine partners exist', () => {
      render(
        <DashboardAffiliatesCard
          affiliates={[
            {
              id: 'aff_1',
              name: 'Real Partner Inc',
              initials: 'RP',
              stats: '5 Sales • $250',
              commission: '+$75',
              avatar: null,
            },
          ]}
        />
      );

      expect(screen.getByText('Real Partner Inc')).toBeDefined();
      expect(screen.getByText('+$75')).toBeDefined();
    });
  });

  describe('DashboardTransactionsCard — Data Truth (Rules 14 & 15)', () => {
    it('renders genuine empty state without fake revenue when transactions are empty', () => {
      render(<DashboardTransactionsCard transactions={[]} />);

      expect(screen.getByText('recentTransactions.emptyTitle')).toBeDefined();
      expect(screen.getByText('recentTransactions.emptyDesc')).toBeDefined();
      expect(screen.getByText('recentTransactions.topup')).toBeDefined();
      expect(screen.queryByText('Floyd Miles')).toBeNull();
      expect(screen.queryByText('John Doe')).toBeNull();
      expect(screen.queryByText('$99.00')).toBeNull();
    });

    it('renders transactions table when genuine records exist', () => {
      render(
        <DashboardTransactionsCard
          transactions={[
            {
              id: 'tx_1',
              date: '2026-09-14',
              customer: 'Acme Corp',
              amount: '$250.00',
              status: 'paid',
            },
          ]}
        />
      );

      expect(screen.getByText('Acme Corp')).toBeDefined();
      expect(screen.getByText('$250.00')).toBeDefined();
      expect(screen.getByText('paid')).toBeDefined();
    });
  });

  describe('DashboardMetricsGrid & DashboardRevenueChart', () => {
    it('renders metrics cards cleanly', () => {
      render(
        <DashboardMetricsGrid
          metrics={[
            { id: 'total_campaigns', value: '12', change: '+2', trend: 'up', icon: 'Megaphone' },
          ]}
        />
      );
      expect(screen.getByText('12')).toBeDefined();
    });

    it('renders revenue chart container', () => {
      render(<DashboardRevenueChart />);
      expect(screen.getByText('revenueChart.title')).toBeDefined();
    });
  });
});
