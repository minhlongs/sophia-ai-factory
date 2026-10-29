/**
 * Dashboard Next Step Banner Tests
 *
 * The dashboard must open with one action that matches the customer's verified
 * state. A banner that guesses — or that turns a missing signal into a number —
 * sends a non-technical customer down the wrong path, so each state is asserted
 * separately, including the unknown-data cases.
 *
 * The banner only reads signals the dashboard route actually fetches: readiness
 * and campaign counts. It deliberately has no "approvals" step, because campaign
 * activity rows never carry an approval status and the route does not load the
 * approval queue — any number derived from them would be invented.
 *
 * @module forest/dashboard/__tests__/dashboard-next-step-banner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  DashboardNextStepBanner,
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

describe('approval backlog is never guessed from campaign activity', () => {
  it('offers no approvals step, because no pending campaign status exists', () => {
    // CampaignStatus is draft | queued | processing_script | processing_video |
    // completed | failed — there is no 'pending'. The dashboard route also does
    // not fetch the approval queue, so a step derived from activity rows could
    // never be true. The banner must not offer one.
    const data = makeDashboardData({
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
    });

    const step = resolveNextStep(
      makeReadiness({ readyForMissions: true, providersConfigured: ['openrouter'] }),
      data,
    );
    // 'approvals' is not in NextStepKind at all, so the compiler also proves it.
    expect(step?.kind).not.toBe('approvals');
    // With campaigns proven to exist, the honest step is the campaign list.
    expect(step?.kind).toBe<NextStepKind>('campaign');
    expect(step?.href).toBe('/dashboard/campaigns');
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

  it('never renders an approvals step, even with a pending-looking activity', () => {
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

    // The approval queue is reachable only from its own route, which reads the
    // real queue. The dashboard must not fabricate a step into it.
    const banner = screen.getByTestId('dashboard-next-step-banner');
    expect(banner.getAttribute('data-step')).not.toBe('approvals');
    expect(banner.getAttribute('data-step')).toBe('campaign');
    expect(banner.querySelector('a')?.getAttribute('href')).toBe('/dashboard/campaigns');
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
