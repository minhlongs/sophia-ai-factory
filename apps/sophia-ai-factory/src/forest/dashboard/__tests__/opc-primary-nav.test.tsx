/**
 * B06: six primary work groups, real routes, deep links preserved, and the
 * referral programme kept separate from external affiliate business.
 * No browser — jsdom component test only.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DashboardSidebarNav } from '../dashboard-sidebar-nav';
import {
  OPC_PRIMARY_NAV_GROUPS,
  OPC_REFERRAL_NAV_ITEM,
  SOPHIA_NAV_MODULES,
} from '../dashboard-nav-modules';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/navigation', () => ({
  Link: ({ children, href, className, onClick }: {
    children: React.ReactNode; href: string; className?: string; onClick?: () => void;
  }) => <a href={href} className={className} onClick={onClick}>{children}</a>,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

const EXISTING_DASHBOARD_ROUTES = new Set([
  '/dashboard', '/dashboard/affiliate', '/dashboard/affiliates', '/dashboard/campaigns',
  '/dashboard/approvals', '/dashboard/settings', '/dashboard/missions',
  '/dashboard/creative-economy', '/dashboard/image-studio', '/dashboard/youtube',
  '/dashboard/playbooks', '/dashboard/publish/queue', '/dashboard/sops',
  '/dashboard/sop-marketplace', '/dashboard/challenges', '/dashboard/handover',
  '/dashboard/docs/runbooks', '/dashboard/system-health', '/dashboard/missions/new',
]);

describe('OPC primary navigation', () => {
  it('has exactly six work groups, all pointing at existing dashboard routes', () => {
    expect(OPC_PRIMARY_NAV_GROUPS).toHaveLength(6);
    for (const item of OPC_PRIMARY_NAV_GROUPS) {
      expect(EXISTING_DASHBOARD_ROUTES.has(item.href), item.href).toBe(true);
    }
  });

  it('renders primary groups, keeps all 16 deep links, and separates Refer Sophia', () => {
    const { container } = render(<DashboardSidebarNav />);

    const primaryNav = screen.getByRole('navigation', { name: 'Platform Navigation' });
    expect(within(primaryNav).getAllByRole('link')).toHaveLength(6);

    for (const item of SOPHIA_NAV_MODULES) {
      expect(
        container.querySelector(`a[href="${item.href}"]`),
        `deep link ${item.href} must remain reachable`,
      ).not.toBeNull();
    }

    const referralNav = screen.getByRole('navigation', { name: 'Referral programme' });
    expect(within(referralNav).getByRole('link').getAttribute('href')).toBe(OPC_REFERRAL_NAV_ITEM.href);
    expect(OPC_REFERRAL_NAV_ITEM.href).not.toContain('affiliate');
  });

  it('renders Vietnamese primary labels when isVi is true', () => {
    render(<DashboardSidebarNav isVi={true} />);
    const primaryNav = screen.getByRole('navigation', { name: 'Nền Tảng AI' });
    expect(within(primaryNav).getAllByRole('link').length).toBe(6);
    expect(screen.getByText('Cần duyệt')).toBeDefined();
    expect(screen.getByText('Kết quả')).toBeDefined();
    expect(screen.getByText('Kết nối')).toBeDefined();
  });
});
