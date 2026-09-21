import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardMetricsGrid } from '../dashboard-metrics-grid';
import { DashboardOnboardingBanner } from '../dashboard-onboarding-banner';
import { DashboardActivityTable } from '../dashboard-activity-table';

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

describe('Dashboard KPI & Activity Components — Obsidian Cyber-Glass', () => {
  describe('DashboardMetricsGrid', () => {
    it('renders 4 distinct glowing KPI cards with tinted pills and trend badges', () => {
      render(
        <DashboardMetricsGrid
          metrics={[
            { id: 'total_campaigns', value: '45', change: '+12%', trend: 'up', icon: 'Megaphone' },
            { id: 'active_campaigns', value: '12', change: '+3', trend: 'up', icon: 'Play' },
            { id: 'videos_generated', value: '320', change: '+25%', trend: 'up', icon: 'Video' },
            { id: 'success_rate', value: '99.1%', change: 'neutral', trend: 'neutral', icon: 'TrendingUp' },
          ]}
        />
      );

      // Verify values
      expect(screen.getByText('45')).toBeDefined();
      expect(screen.getByText('12')).toBeDefined();
      expect(screen.getByText('320')).toBeDefined();
      expect(screen.getByText('99.1%')).toBeDefined();

      // Verify tinted pill classes
      const indigoPill = screen.getByTestId('kpi-pill-total_campaigns');
      expect(indigoPill.className).toContain('text-indigo-400');

      const emeraldPill = screen.getByTestId('kpi-pill-active_campaigns');
      expect(emeraldPill.className).toContain('text-emerald-400');

      const violetPill = screen.getByTestId('kpi-pill-videos_generated');
      expect(violetPill.className).toContain('text-violet-400');

      const amberPill = screen.getByTestId('kpi-pill-success_rate');
      expect(amberPill.className).toContain('text-amber-400');
    });
  });

  describe('DashboardOnboardingBanner', () => {
    it('links to canonical /dashboard/setup and /dashboard/system-health', () => {
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
            issues: ['Missing BYOK'],
          }}
        />
      );

      const setupLink = document.querySelector('a[href="/dashboard/setup"]');
      expect(setupLink).not.toBeNull();

      const healthLink = document.querySelector('a[href="/dashboard/system-health"]');
      expect(healthLink).not.toBeNull();
    });

    it('renders ready banner when all systems operational', () => {
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

      expect(screen.getByTestId('onboarding-ready-banner')).toBeDefined();
      expect(screen.getByText('ready')).toBeDefined();
    });
  });

  describe('DashboardActivityTable', () => {
    it('renders genuine empty state when activities are empty', () => {
      render(<DashboardActivityTable activities={[]} />);

      expect(screen.getByText('recentTransactions.emptyTitle')).toBeDefined();
      expect(screen.getByText('recentTransactions.emptyDesc')).toBeDefined();
    });

    it('renders missions alongside transactions with status pills', () => {
      render(
        <DashboardActivityTable
          activities={[
            {
              id: 'act_1',
              type: 'mission',
              title: 'Viral Hook Campaign #42',
              status: 'completed',
              date: '2026-09-20',
            },
            {
              id: 'act_2',
              type: 'mission',
              title: 'Batch Shorts Generation',
              status: 'processing',
              date: '2026-09-21',
            },
            {
              id: 'act_3',
              type: 'payment',
              customer: 'Acme Studio Corp',
              amount: '$499.00',
              status: 'failed',
              date: '2026-09-21',
            },
          ]}
        />
      );

      expect(screen.getByText('Viral Hook Campaign #42')).toBeDefined();
      expect(screen.getByText('Batch Shorts Generation')).toBeDefined();
      expect(screen.getByText('Acme Studio Corp')).toBeDefined();
      expect(screen.getByText('$499.00')).toBeDefined();

      // Check status pills
      expect(screen.getByTestId('status-pill-completed')).toBeDefined();
      expect(screen.getByTestId('status-pill-processing')).toBeDefined();
      expect(screen.getByTestId('status-pill-failed')).toBeDefined();
    });
  });
});
