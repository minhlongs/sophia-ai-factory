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
  '/dashboard', '/dashboard/first-value', '/dashboard/engines', '/dashboard/monetization',
  '/dashboard/affiliate', '/dashboard/affiliates', '/dashboard/campaigns',
  '/dashboard/approvals', '/dashboard/settings', '/dashboard/missions',
  '/dashboard/creative-economy', '/dashboard/image-studio', '/dashboard/youtube',
  '/dashboard/playbooks', '/dashboard/publish/queue', '/dashboard/sops',
  '/dashboard/sop-marketplace', '/dashboard/challenges', '/dashboard/handover',
  '/dashboard/docs/runbooks', '/dashboard/system-health', '/dashboard/missions/new',
]);

describe('OPC primary navigation', () => {
  it('has exactly nine work groups, all pointing at existing dashboard routes', () => {
    expect(OPC_PRIMARY_NAV_GROUPS).toHaveLength(9);
    for (const item of OPC_PRIMARY_NAV_GROUPS) {
      expect(EXISTING_DASHBOARD_ROUTES.has(item.href), item.href).toBe(true);
    }
  });

  it('renders 7 customer-facing primary groups including Distribution Center & Approvals, keeps all 18 deep links for admins, and separates Refer Sophia', () => {
    const { container } = render(<DashboardSidebarNav isAdmin />);

    const primaryNav = screen.getByRole('navigation', { name: 'Platform Navigation' });
    expect(within(primaryNav).getAllByRole('link')).toHaveLength(7);
    expect(container.querySelector('a[href="/dashboard/publish/queue"]')).not.toBeNull();
    expect(container.querySelector('a[href="/dashboard/approvals"]')).not.toBeNull();

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

  it('renders Vietnamese primary labels including Trung tâm Phân phối and Cần duyệt for normal customers without admin modules', () => {
    const { container } = render(<DashboardSidebarNav isVi={true} isAdmin={false} />);
    const primaryNav = screen.getByRole('navigation', { name: 'Nền Tảng AI' });
    expect(within(primaryNav).getAllByRole('link').length).toBe(7);
    expect(screen.getByText('Trung tâm Phân phối')).toBeDefined();
    expect(screen.getByText('Cần duyệt')).toBeDefined();
    expect(screen.getByText('Kết quả')).toBeDefined();
    expect(screen.getByText('Kết nối')).toBeDefined();
    expect(container.querySelector('a[href="/dashboard/system-health"]')).toBeNull();
  });
});
