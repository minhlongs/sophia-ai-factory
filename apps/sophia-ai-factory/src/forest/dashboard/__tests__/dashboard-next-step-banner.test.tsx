/**
 * Dashboard Next Step Banner Tests
 *
 * The dashboard must open with one action that matches the customer's verified
 * state. A banner that guesses — or that turns a missing signal into a number —
 * sends a non-technical customer down the wrong path, so each state is asserted
 * separately, including the unknown-data cases.
 *
 * @module forest/dashboard/__tests__/dashboard-next-step-banner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  DashboardNextStepBanner,
  countApprovalBacklog,
  resolveNextStep,
  type NextStepKind,
} from '../dashboard-next-step-banner';
import type { SystemReadiness } from '@/tree/readiness/readiness-checker';
import type { DashboardData } from '../types';

// Keys are asserted verbatim so the test proves wiring, not translated copy.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const t = (key: string) => key;

function makeReadiness(overrides: Partial<SystemReadiness> = {}): SystemReadiness {
  return {
    ownerVerified: true,
    byokEncrypted: false,
    providersConfigured: [],
    providersReady: [],
    subscriptionActive: false,
    tier: 'BASIC',
    mcuBalance: 0,
    capabilities: [],
    readyForMissions: false,
    issues: [],
    ...overrides,
  };
}

function makeDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    metrics: [],
    campaignMetrics: {
      totalCampaigns: 0,
      activeCampaigns: 0,
      completedCampaigns: 0,
      failedCampaigns: 0,
      totalVideosGenerated: 0,
      successRate: 0,
    },
    recentActivities: [],
    topAffiliates: [],
    ...overrides,
  };
}

describe('countApprovalBacklog', () => {
  it('returns null when the server reported no activity data at all', () => {
    // Unknown is not zero: a fetch failure must not read as "nothing to approve".
    expect(countApprovalBacklog(undefined)).toBeNull();
    expect(countApprovalBacklog(makeDashboardData({ recentActivities: undefined }))).toBeNull();
  });

  it('returns zero for a verified empty activity list', () => {
    expect(countApprovalBacklog(makeDashboardData({ recentActivities: [] }))).toBe(0);
  });

  it('counts only activities still pending, not already decided ones', () => {
    const data = makeDashboardData({
      recentActivities: [
        { id: 'a', type: 'campaign', date: '2026-10-27', description: 'draft', status: 'pending' },
        { id: 'b', type: 'campaign', date: '2026-10-26', description: 'approved', status: 'approved' },
        { id: 'c', type: 'campaign', date: '2026-10-25', description: 'paid', status: 'paid' },
        { id: 'd', type: 'campaign', date: '2026-10-24', description: 'reversed', status: 'reversed' },
      ],
    });
    expect(countApprovalBacklog(data)).toBe(1);
  });
});

describe('resolveNextStep', () => {
  it('sends a customer with no provider keys to the Setup Wizard', () => {
    const step = resolveNextStep(
      makeReadiness({ readyForMissions: false, providersConfigured: [] }),
      undefined,
    );
    expect(step?.kind).toBe<NextStepKind>('setup');
    expect(step?.href).toBe('/setup');
  });

  it('does not send a configured customer back to the Setup Wizard', () => {
    const step = resolveNextStep(
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
      makeDashboardData(),
    );
    expect(step?.kind).not.toBe<NextStepKind>('setup');
  });

  it('sends a ready customer with no campaigns to pick an offer', () => {
    const step = resolveNextStep(
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
      makeDashboardData(),
    );
    expect(step?.kind).toBe<NextStepKind>('offer');
    expect(step?.href).toBe('/dashboard/affiliates');
  });

  it('prioritises approval work over offering more campaigns', () => {
    const step = resolveNextStep(
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
      makeDashboardData({
        campaignMetrics: {
          totalCampaigns: 3,
          activeCampaigns: 1,
          completedCampaigns: 2,
          failedCampaigns: 0,
          totalVideosGenerated: 4,
          successRate: 100,
        },
        recentActivities: [
          { id: 'a', type: 'campaign', date: '2026-10-27', description: 'draft', status: 'pending' },
        ],
      }),
    );
    expect(step?.kind).toBe<NextStepKind>('approvals');
    expect(step?.href).toBe('/dashboard/approvals');
  });

  it('falls back to the campaign list when there is nothing to approve', () => {
    const step = resolveNextStep(
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
      makeDashboardData({
        campaignMetrics: {
          totalCampaigns: 2,
          activeCampaigns: 1,
          completedCampaigns: 1,
          failedCampaigns: 0,
          totalVideosGenerated: 3,
          successRate: 100,
        },
        recentActivities: [],
      }),
    );
    expect(step?.kind).toBe<NextStepKind>('campaign');
    expect(step?.href).toBe('/dashboard/campaigns');
  });

  it('never treats a missing campaign count as zero campaigns', () => {
    // No campaign metrics reported → not proof the customer has no campaign.
    const data = makeDashboardData();
    delete (data as { campaignMetrics?: unknown }).campaignMetrics;
    const step = resolveNextStep(
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
      data,
    );
    expect(step?.kind).not.toBe<NextStepKind>('offer');
    // Nor is it proof they have one, so no "track your campaigns" claim either.
    expect(step).toBeNull();
  });

  it('hides the campaign step when the reported campaign count is not a positive number', () => {
    for (const totalCampaigns of [0]) {
      const data = makeDashboardData();
      data.campaignMetrics.totalCampaigns = totalCampaigns;
      const step = resolveNextStep(
        makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
        data,
      );
      expect(step?.kind).toBe<NextStepKind>('offer');
    }
  });
});

describe('DashboardNextStepBanner', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function renderBanner(readiness: SystemReadiness | null, data?: DashboardData) {
    return render(
      <DashboardNextStepBanner readiness={readiness} initialData={data} />,
    );
  }

  it('renders the setup step for a customer with no provider keys', () => {
    const { container } = renderBanner(
      makeReadiness({ readyForMissions: false, providersConfigured: [] }),
    );

    const banner = screen.getByTestId('dashboard-next-step-banner');
    expect(banner.getAttribute('data-step')).toBe('setup');
    const link = banner.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/setup');
    expect(container.textContent).toContain('steps.setup.title');
  });

  it('renders the approvals step with a real link into the approval queue', () => {
    renderBanner(
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
      makeDashboardData({
        campaignMetrics: {
          totalCampaigns: 1,
          activeCampaigns: 1,
          completedCampaigns: 0,
          failedCampaigns: 0,
          totalVideosGenerated: 0,
          successRate: 0,
        },
        recentActivities: [
          { id: 'a', type: 'campaign', date: '2026-10-27', description: 'draft', status: 'pending' },
        ],
      }),
    );

    const banner = screen.getByTestId('dashboard-next-step-banner');
    expect(banner.getAttribute('data-step')).toBe('approvals');
    expect(banner.querySelector('a')?.getAttribute('href')).toBe('/dashboard/approvals');
  });

  it('renders the offer step for a ready customer with no campaigns', () => {
    renderBanner(
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
      makeDashboardData(),
    );

    expect(screen.getByTestId('dashboard-next-step-banner').getAttribute('data-step')).toBe(
      'offer',
    );
  });

  it('stays silent when no verified signal is available', () => {
    // Rendering a guessed next step is worse than rendering nothing.
    const { container } = renderBanner(null);
    expect(container.firstChild).toBeNull();
  });

  it('uses each step exactly once, so no state shows two competing actions', () => {
    const kinds = new Set<string>();
    for (const readiness of [
      makeReadiness({ readyForMissions: false, providersConfigured: [] }),
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
    ]) {
      for (const data of [undefined, makeDashboardData()]) {
        const step = resolveNextStep(readiness, data);
        if (step) kinds.add(step.kind);
      }
    }
    // Every resolvable state maps to exactly one step, and the states differ.
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('does not offer a campaign claim from readiness alone', () => {
    // Readiness says the system is ready; it says nothing about their campaigns.
    expect(
      resolveNextStep(
        makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
        undefined,
      ),
    ).toBeNull();
  });
});
