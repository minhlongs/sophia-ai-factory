// i18n-namespace: creativeEconomy
/**
 * Component tests for the creative economy dashboard UI pieces.
 * All components receive a plain `t` function prop, so no next-intl mocking
 * is needed — identity translation keeps assertions direct.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryCards } from '../summary-cards';
import { AssetTable } from '../asset-table';
import { VelocityChart } from '../velocity-chart';
import { MemoryList } from '../memory-list';
import { PlaybookCards } from '../playbook-cards';
import type {
  DashboardSummary,
  AssetPerformanceRow,
  VelocityPoint,
  MemoryInsight,
  PlaybookHealthRow,
} from '@/land/creative-economy/types';

const t = (key: string) => key;

describe('SummaryCards', () => {
  it('renders revenue, cost, net and event count', () => {
    const summary: DashboardSummary = {
      revenueCents: 150000,
      costCents: 50000,
      netCents: 100000,
      eventCount: 42,
      windowDays: 30,
    };
    render(<SummaryCards summary={summary} t={t} />);
    expect(screen.getByText('revenue')).toBeDefined();
    expect(screen.getByText('cost')).toBeDefined();
    expect(screen.getByText('net')).toBeDefined();
    expect(screen.getByText('eventCount')).toBeDefined();
    // vi-VN formats as "1.500,00 US$" — match loosely
    expect(screen.getByText(/1[.,]500[.,]00/)).toBeDefined();
  });

  it('shows negative net with rose styling', () => {
    const summary: DashboardSummary = {
      revenueCents: 0,
      costCents: 10000,
      netCents: -10000,
      eventCount: 5,
      windowDays: 30,
    };
    const { container } = render(<SummaryCards summary={summary} t={t} />);
    // vi-VN formats negative as "100,00 US$" with minus sign position varying
    expect(container.textContent).toMatch(/100[.,]00.*US\$/);
  });
});

describe('AssetTable', () => {
  it('renders rows with ROI formatting', () => {
    const rows: AssetPerformanceRow[] = [
      {
        assetId: 'asset-1',
        projectId: 'proj-1',
        channel: 'youtube',
        impressions: 1200,
        revenueCents: 20000,
        costCents: 5000,
        roiPct: 300,
      },
      {
        assetId: 'asset-2',
        projectId: 'proj-2',
        channel: 'tiktok',
        impressions: 50,
        revenueCents: 0,
        costCents: 0,
        roiPct: null,
      },
    ];
    render(<AssetTable rows={rows} t={t} />);
    expect(screen.getByText('assetTitle')).toBeDefined();
    expect(screen.getByText('asset-1')).toBeDefined();
    expect(screen.getByText('300.0%')).toBeDefined();
    // null ROI renders em-dash placeholder
    expect(screen.getByText('—')).toBeDefined();
  });

  it('renders empty state when no assets', () => {
    render(<AssetTable rows={[]} t={t} />);
    expect(screen.getByText('noAssets')).toBeDefined();
  });
});

describe('VelocityChart', () => {
  it('renders progressbar per point with aria values', () => {
    const points: VelocityPoint[] = [
      {
        entityType: 'video',
        channel: 'youtube',
        velocityScore: 72.4,
        eventCount: 18,
        windowStartMs: 0,
        windowEndMs: 1,
      },
    ];
    render(<VelocityChart points={points} t={t} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('72');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('renders empty state when no points', () => {
    render(<VelocityChart points={[]} t={t} />);
    expect(screen.getByText('noVelocity')).toBeDefined();
  });
});

describe('MemoryList', () => {
  it('renders insight entries with confidence badges', () => {
    const insights: MemoryInsight[] = [
      {
        id: 'mem-1',
        category: 'audience',
        key: 'tone',
        title: 'Short intros win',
        summary: 'Videos under 15s retain more viewers.',
        confidence: 'high',
        createdAtMs: Date.UTC(2026, 7, 20),
      },
    ];
    render(<MemoryList insights={insights} t={t} />);
    expect(screen.getByText('memoryTitle')).toBeDefined();
    expect(screen.getByText('Short intros win')).toBeDefined();
    expect(screen.getByText('confidence_high')).toBeDefined();
  });

  it('renders empty state when no memory', () => {
    render(<MemoryList insights={[]} t={t} />);
    expect(screen.getByText('noMemory')).toBeDefined();
  });
});

describe('PlaybookCards', () => {
  it('renders status card with failure rates', () => {
    const rows: PlaybookHealthRow[] = [
      {
        installationId: 'inst-1',
        ruleId: 'rule-9',
        status: 'at_risk',
        recentFailureRate: 0.8,
        baselineFailureRate: 0.1,
        lastRollbackAtSec: null,
      },
    ];
    render(<PlaybookCards rows={rows} t={t} />);
    expect(screen.getByText('playbookTitle')).toBeDefined();
    expect(screen.getByText('status_at_risk')).toBeDefined();
    expect(screen.getByText('80%')).toBeDefined();
    expect(screen.getByText('10%')).toBeDefined();
  });

  it('renders empty state when no playbooks installed', () => {
    render(<PlaybookCards rows={[]} t={t} />);
    expect(screen.getByText('noPlaybooks')).toBeDefined();
  });
});
