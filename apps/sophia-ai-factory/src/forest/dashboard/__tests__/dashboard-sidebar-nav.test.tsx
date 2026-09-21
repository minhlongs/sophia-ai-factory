import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DashboardSidebarNav,
  SOPHIA_NAV_MODULES,
} from '../dashboard-sidebar-nav';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'sidebar.overview': 'Overview',
      'sidebar.create_mission': 'Create Mission',
      'sidebar.missions': 'AI Missions',
      'sidebar.creative_studio': 'Creative Studio',
      'sidebar.youtube_automation': 'YouTube Automation',
      'sidebar.playbook': 'Playbooks',
      'sidebar.publish_queue': 'Distribution Queue',
      'sidebar.marketplace': 'Creator Marketplace',
      'sidebar.handover': 'Handover & Acceptance',
      'sidebar.runbooks': 'Runbooks',
      'sidebar.system_health': 'System Health',
    };
    return translations[key] || key;
  },
}));

// Mock @/navigation Link
vi.mock('@/navigation', () => ({
  Link: ({
    children,
    href,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

describe('DashboardSidebarNav — Obsidian Cyber-Glass Navigation', () => {
  it('renders all 11 canonical Sophia AI modules with valid hrefs', () => {
    render(<DashboardSidebarNav />);

    expect(SOPHIA_NAV_MODULES).toHaveLength(11);

    const expectedHrefs = [
      '/dashboard',
      '/dashboard/missions/new',
      '/dashboard/missions',
      '/dashboard/creative-economy',
      '/dashboard/youtube',
      '/dashboard/playbooks',
      '/dashboard/publish/queue',
      '/marketplace',
      '/dashboard/handover',
      '/dashboard/docs/runbooks',
      '/dashboard/system-health',
    ];

    for (const href of expectedHrefs) {
      const link = document.querySelector(`a[href="${href}"]`);
      expect(link).not.toBeNull();
    }
  });

  it('highlights the active route with primary glow styling', () => {
    render(<DashboardSidebarNav currentPath="/dashboard/missions" />);

    const missionsLink = document.querySelector('a[href="/dashboard/missions"]');
    expect(missionsLink).not.toBeNull();
    expect(missionsLink?.className).toContain('bg-primary/10');
    expect(missionsLink?.className).toContain('border-primary/30');

    // Overview should NOT have active class when on missions
    const overviewLink = document.querySelector('a[href="/dashboard"]');
    expect(overviewLink?.className).not.toContain('bg-primary/10');
  });

  it('renders admin console navigation conditionally only when isAdmin=true', () => {
    const { rerender } = render(<DashboardSidebarNav isAdmin={false} />);
    expect(screen.queryByText('Handover Console')).toBeNull();

    rerender(<DashboardSidebarNav isAdmin={true} />);
    expect(screen.getByText('Handover Console')).toBeDefined();
    expect(screen.getByText('Ops Dashboard')).toBeDefined();
  });

  it('renders bottom user profile card with tier badge, quota bar, and upgrade CTA', () => {
    render(
      <DashboardSidebarNav
        user={{
          name: 'Long Hoang',
          email: 'long@sophia.ai',
          tier: 'MASTER',
          quotaUsagePercent: 85,
          quotaUsed: 850,
          quotaTotal: 1000,
        }}
      />
    );

    expect(screen.getByText('Long Hoang')).toBeDefined();
    expect(screen.getByText('long@sophia.ai')).toBeDefined();
    expect(screen.getByText('MASTER')).toBeDefined();
    expect(screen.getByText('85%')).toBeDefined();

    const upgradeLink = screen.getByText('Upgrade Tier');
    expect(upgradeLink).toBeDefined();
    expect(upgradeLink.closest('a')?.getAttribute('href')).toBe('/pricing');
  });

  it('supports mobile drawer toggle and invokes onCloseMobile on link click', () => {
    const onCloseMobile = vi.fn();
    render(
      <DashboardSidebarNav
        isMobileOpen={true}
        onCloseMobile={onCloseMobile}
      />
    );

    const backdrop = screen.getByTestId('mobile-drawer-backdrop');
    expect(backdrop).toBeDefined();

    fireEvent.click(backdrop);
    expect(onCloseMobile).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByLabelText('Close navigation');
    fireEvent.click(closeBtn);
    expect(onCloseMobile).toHaveBeenCalledTimes(2);
  });
});
