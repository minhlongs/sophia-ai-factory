import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  DashboardSidebarNav,
  SOPHIA_NAV_MODULES,
  type DashboardNavModule,
} from '../dashboard-sidebar-nav';
import { DashboardShell } from '../dashboard-shell';

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
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
const mockPathname = vi.fn(() => '/dashboard');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('CHALLENGER 1 EMPIRICAL SUITE: DashboardSidebarNav & Shell Navigation', () => {
  /* =========================================================================
   * 1. EMPIRICAL ROUTE VERIFICATION: All 11 Canonical Modules
   * ========================================================================= */
  describe('1. Canonical 11 Sophia AI Module Routes & Icons', () => {
    it('declares exactly 11 canonical Sophia AI modules in SOPHIA_NAV_MODULES', () => {
      expect(SOPHIA_NAV_MODULES).toHaveLength(11);
    });

    const expectedModules: Array<{
      id: string;
      labelKey: string;
      fallbackLabel: string;
      href: string;
    }> = [
      { id: 'overview', labelKey: 'sidebar.overview', fallbackLabel: 'Overview', href: '/dashboard' },
      { id: 'create_mission', labelKey: 'sidebar.create_mission', fallbackLabel: 'Create Mission', href: '/dashboard/missions/new' },
      { id: 'missions', labelKey: 'sidebar.missions', fallbackLabel: 'AI Missions', href: '/dashboard/missions' },
      { id: 'creative_studio', labelKey: 'sidebar.creative_studio', fallbackLabel: 'Creative Studio', href: '/dashboard/creative-economy' },
      { id: 'youtube_automation', labelKey: 'sidebar.youtube_automation', fallbackLabel: 'YouTube Automation', href: '/dashboard/youtube' },
      { id: 'playbooks', labelKey: 'sidebar.playbook', fallbackLabel: 'Playbooks', href: '/dashboard/playbooks' },
      { id: 'publish_queue', labelKey: 'sidebar.publish_queue', fallbackLabel: 'Distribution Queue', href: '/dashboard/publish/queue' },
      { id: 'marketplace', labelKey: 'sidebar.marketplace', fallbackLabel: 'Creator Marketplace', href: '/marketplace' },
      { id: 'handover', labelKey: 'sidebar.handover', fallbackLabel: 'Handover & Acceptance', href: '/dashboard/handover' },
      { id: 'runbooks', labelKey: 'sidebar.runbooks', fallbackLabel: 'Runbooks', href: '/dashboard/docs/runbooks' },
      { id: 'system_health', labelKey: 'sidebar.system_health', fallbackLabel: 'System Health', href: '/dashboard/system-health' },
    ];

    expectedModules.forEach((expected, idx) => {
      it(`module [${idx + 1}/11] "${expected.id}" has valid configuration and renders with icon`, () => {
        const item = SOPHIA_NAV_MODULES[idx];
        expect(item.id).toBe(expected.id);
        expect(item.labelKey).toBe(expected.labelKey);
        expect(item.fallbackLabel).toBe(expected.fallbackLabel);
        expect(item.href).toBe(expected.href);
        expect(item.icon).toBeDefined();
        expect(typeof item.icon).toBe('object'); // Lucide forwardRef icon

        const { container } = render(<DashboardSidebarNav currentPath="/some-other-path" />);
        const link = container.querySelector(`a[href="${expected.href}"]`);
        expect(link).not.toBeNull();
        expect(link?.textContent).toContain(expected.fallbackLabel);

        // Verify Lucide icon SVG renders inside link
        const iconSvg = link?.querySelector('svg');
        expect(iconSvg).not.toBeNull();
        expect(iconSvg?.getAttribute('aria-hidden')).toBe('true');
      });
    });

    it('empirically verifies active indicator glow and left-bar on each module route', () => {
      // Test each route when it is the exact current route
      expectedModules.forEach((mod) => {
        const { container } = render(<DashboardSidebarNav currentPath={mod.href} />);
        const activeLink = container.querySelector(`a[href="${mod.href}"]`);
        expect(activeLink).not.toBeNull();

        // Active styling assertions
        expect(activeLink?.className).toContain('bg-primary/10');
        expect(activeLink?.className).toContain('border-primary/30');

        // Active left gradient indicator bar
        const activeBar = activeLink?.querySelector('span.bg-gradient-to-b');
        expect(activeBar).not.toBeNull();
      });
    });

    it('empirically checks route exclusivity when on /dashboard (root does not match subpaths)', () => {
      const { container } = render(<DashboardSidebarNav currentPath="/dashboard" />);
      const overviewLink = container.querySelector('a[href="/dashboard"]');
      expect(overviewLink?.className).toContain('bg-primary/10');

      // None of the other 10 routes should be active
      for (const mod of expectedModules) {
        if (mod.href !== '/dashboard') {
          const otherLink = container.querySelector(`a[href="${mod.href}"]`);
          expect(otherLink?.className).not.toContain('bg-primary/10');
        }
      }
    });

    it('empirically examines nested route matching on /dashboard/missions/new', () => {
      const { container } = render(<DashboardSidebarNav currentPath="/dashboard/missions/new" />);
      const createMissionLink = container.querySelector('a[href="/dashboard/missions/new"]');
      expect(createMissionLink?.className).toContain('bg-primary/10');

      // Check whether /dashboard/missions is also marked active due to startsWith prefix matching
      const missionsLink = container.querySelector('a[href="/dashboard/missions"]');
      expect(missionsLink?.className).toContain('bg-primary/10');
    });

    it('handles localized pathnames correctly (/vi/dashboard and /en/dashboard)', () => {
      const { container: viContainer } = render(<DashboardSidebarNav currentPath="/vi/dashboard/youtube" />);
      const ytLinkVi = viContainer.querySelector('a[href="/dashboard/youtube"]');
      expect(ytLinkVi?.className).toContain('bg-primary/10');

      const { container: enContainer } = render(<DashboardSidebarNav currentPath="/en/dashboard/handover" />);
      const handoverLinkEn = enContainer.querySelector('a[href="/dashboard/handover"]');
      expect(handoverLinkEn?.className).toContain('bg-primary/10');
    });
  });

  /* =========================================================================
   * 2. STRESS TESTING: Bottom User Profile Card with Extreme Inputs
   * ========================================================================= */
  describe('2. Bottom User Profile Card Stress Testing', () => {
    it('survives extreme 100+ character name without crashing or layout distortion', () => {
      const longName = 'Hubert Blaine Wolfeschlegelsteinhausenbergerdorff Senior The Third Of His Name And Lineage Who Has An Extremely Long Name That Exceeds All Common Normal Bounds';
      const longEmail = 'very.long.enterprise.customer.identifier.with.multiple.subdomains.and.tracking.tokens@enterprise-customer-domain-production-node-alpha.sophia.network';

      const { container } = render(
        <DashboardSidebarNav
          user={{
            name: longName,
            email: longEmail,
            tier: 'ENTERPRISE',
            quotaUsagePercent: 50,
            quotaUsed: 500,
            quotaTotal: 1000,
          }}
        />
      );

      // Verify name rendered
      expect(screen.getByText(longName)).toBeDefined();
      expect(screen.getByText(longEmail)).toBeDefined();

      // Check that initials logic handled 100+ char name safely (extracted 2 uppercase characters)
      const initialsElement = container.querySelector('.rounded-full.bg-primary\\/20');
      expect(initialsElement?.textContent?.length).toBe(2);
      expect(initialsElement?.textContent).toBe('HB');

      // Check that truncation classes are applied to prevent visual overflow
      const nameP = screen.getByText(longName);
      expect(nameP.className).toContain('truncate');

      const emailP = screen.getByText(longEmail);
      expect(emailP.className).toContain('truncate');

      const textContainer = nameP.parentElement;
      expect(textContainer?.className).toContain('min-w-0');
      expect(textContainer?.className).toContain('truncate');
    });

    it('stress tests quota edge cases: 0% quota', () => {
      const { container } = render(
        <DashboardSidebarNav
          user={{
            name: 'Zero User',
            email: 'zero@sophia.ai',
            tier: 'FREE',
            quotaUsagePercent: 0,
            quotaUsed: 0,
            quotaTotal: 1000,
          }}
        />
      );

      expect(screen.getByText('0%')).toBeDefined();
      const progressBar = container.querySelector('.bg-gradient-to-r.from-primary.to-accent');
      expect(progressBar?.getAttribute('style')).toContain('width: 0%');
    });

    it('stress tests quota edge cases: 100% quota', () => {
      const { container } = render(
        <DashboardSidebarNav
          user={{
            name: 'Full User',
            email: 'full@sophia.ai',
            tier: 'PRO',
            quotaUsagePercent: 100,
            quotaUsed: 1000,
            quotaTotal: 1000,
          }}
        />
      );

      expect(screen.getByText('100%')).toBeDefined();
      const progressBar = container.querySelector('.bg-gradient-to-r.from-primary.to-accent');
      expect(progressBar?.getAttribute('style')).toContain('width: 100%');
    });

    it('stress tests quota overflow: 150% quota clamped safely to 100% width', () => {
      const { container } = render(
        <DashboardSidebarNav
          user={{
            name: 'Overflow User',
            email: 'overflow@sophia.ai',
            tier: 'MASTER',
            quotaUsagePercent: 150,
            quotaUsed: 1500,
            quotaTotal: 1000,
          }}
        />
      );

      // Quota label displays actual 150%
      expect(screen.getByText('150%')).toBeDefined();

      // CSS bar width MUST be clamped to 100% so it does NOT break out of the container
      const progressBar = container.querySelector('.bg-gradient-to-r.from-primary.to-accent');
      expect(progressBar?.getAttribute('style')).toContain('width: 100%');
    });

    it('stress tests negative quota: -20% clamped safely to 0% width', () => {
      const { container } = render(
        <DashboardSidebarNav
          user={{
            name: 'Negative User',
            email: 'neg@sophia.ai',
            tier: 'STARTER',
            quotaUsagePercent: -20,
            quotaUsed: 0,
            quotaTotal: 1000,
          }}
        />
      );

      expect(screen.getByText('-20%')).toBeDefined();
      const progressBar = container.querySelector('.bg-gradient-to-r.from-primary.to-accent');
      expect(progressBar?.getAttribute('style')).toContain('width: 0%');
    });

    it('verifies tier badges for all tiers (MASTER, ENTERPRISE, PRO, FREE)', () => {
      const tiers = [
        { tier: 'MASTER', expectedClass: 'from-amber-500/20' },
        { tier: 'ENTERPRISE', expectedClass: 'text-primary' },
        { tier: 'PRO', expectedClass: 'text-violet-300' },
        { tier: 'FREE', expectedClass: 'text-muted-foreground' },
      ];

      tiers.forEach(({ tier, expectedClass }) => {
        const { unmount } = render(
          <DashboardSidebarNav
            user={{
              name: 'Tier Tester',
              email: 'tier@sophia.ai',
              tier,
              quotaUsagePercent: 50,
            }}
          />
        );

        const badge = screen.getByText(tier);
        expect(badge).toBeDefined();
        expect(badge.className).toContain(expectedClass);
        unmount();
      });
    });

    it('verifies upgrade CTA link points to /pricing with truncate styling', () => {
      render(<DashboardSidebarNav />);
      const upgradeLink = screen.getByText('Upgrade Tier');
      expect(upgradeLink.closest('a')?.getAttribute('href')).toBe('/pricing');
      expect(upgradeLink.closest('a')?.className).toContain('truncate');
    });
  });

  /* =========================================================================
   * 3. STRESS TESTING: Mobile Drawer Opening/Closing & ARIA Attributes
   * ========================================================================= */
  describe('3. Mobile Drawer Toggle, Visibility & ARIA Attributes', () => {
    it('is completely hidden from DOM when isMobileOpen is false', () => {
      render(<DashboardSidebarNav isMobileOpen={false} />);
      expect(screen.queryByTestId('mobile-drawer-backdrop')).toBeNull();
      expect(screen.queryByTestId('mobile-drawer')).toBeNull();
    });

    it('renders with proper visibility classes and accessibility attributes when isMobileOpen is true', () => {
      const onCloseMobile = vi.fn();
      render(
        <DashboardSidebarNav
          isMobileOpen={true}
          onCloseMobile={onCloseMobile}
        />
      );

      // Backdrop verification
      const backdrop = screen.getByTestId('mobile-drawer-backdrop');
      expect(backdrop).toBeDefined();
      expect(backdrop.getAttribute('aria-hidden')).toBe('true');
      expect(backdrop.className).toContain('fixed');
      expect(backdrop.className).toContain('inset-0');
      expect(backdrop.className).toContain('z-50');
      expect(backdrop.className).toContain('md:hidden');

      // Drawer panel verification
      const drawer = screen.getByTestId('mobile-drawer');
      expect(drawer).toBeDefined();
      expect(drawer.getAttribute('aria-label')).toBe('Mobile navigation drawer');
      expect(drawer.className).toContain('fixed');
      expect(drawer.className).toContain('inset-y-0');
      expect(drawer.className).toContain('left-0');
      expect(drawer.className).toContain('z-50');
      expect(drawer.className).toContain('md:hidden');

      // Close button verification
      const closeBtn = screen.getByLabelText('Close navigation');
      expect(closeBtn).toBeDefined();
      expect(closeBtn.getAttribute('type')).toBe('button');
    });

    it('triggers onCloseMobile when clicking backdrop', () => {
      const onClose = vi.fn();
      render(<DashboardSidebarNav isMobileOpen={true} onCloseMobile={onClose} />);
      fireEvent.click(screen.getByTestId('mobile-drawer-backdrop'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('triggers onCloseMobile when clicking close button', () => {
      const onClose = vi.fn();
      render(<DashboardSidebarNav isMobileOpen={true} onCloseMobile={onClose} />);
      fireEvent.click(screen.getByLabelText('Close navigation'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('triggers onCloseMobile when clicking any navigation link inside the drawer', () => {
      const onClose = vi.fn();
      render(<DashboardSidebarNav isMobileOpen={true} onCloseMobile={onClose} />);
      const drawer = screen.getByTestId('mobile-drawer');
      const drawerLinks = within(drawer).getAllByRole('link');
      expect(drawerLinks.length).toBeGreaterThanOrEqual(11);

      // Click the 3rd link (AI Missions)
      fireEvent.click(drawerLinks[2]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('triggers onCloseMobile when clicking upgrade CTA inside the drawer', () => {
      const onClose = vi.fn();
      render(<DashboardSidebarNav isMobileOpen={true} onCloseMobile={onClose} />);
      const drawer = screen.getByTestId('mobile-drawer');
      const upgradeBtn = within(drawer).getByText('Upgrade Tier');
      fireEvent.click(upgradeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('verifies end-to-end mobile drawer interaction in DashboardShell', () => {
      render(
        <DashboardShell>
          <div data-testid="child-content">Dashboard Content</div>
        </DashboardShell>
      );

      // Content renders
      expect(screen.getByTestId('child-content')).toBeDefined();

      // Initially drawer is closed
      expect(screen.queryByTestId('mobile-drawer')).toBeNull();

      // Click hamburger trigger in TopBar
      const hamburger = screen.getByTestId('mobile-drawer-trigger');
      expect(hamburger).toBeDefined();
      fireEvent.click(hamburger);

      // Drawer is now open
      const drawer = screen.getByTestId('mobile-drawer');
      expect(drawer).toBeDefined();

      // Click backdrop to close
      const backdrop = screen.getByTestId('mobile-drawer-backdrop');
      fireEvent.click(backdrop);

      // Drawer is now closed again
      expect(screen.queryByTestId('mobile-drawer')).toBeNull();
    });
  });

  /* =========================================================================
   * 4. BILINGUAL & ADMIN STRESS TESTING
   * ========================================================================= */
  describe('4. Bilingual (isVi) and Admin (isAdmin) Modes', () => {
    it('renders Vietnamese UI text when isVi=true', () => {
      render(<DashboardSidebarNav isVi={true} />);
      expect(screen.getByText('Nền Tảng AI')).toBeDefined();
      expect(screen.getByText('Nâng Cấp Gói')).toBeDefined();
    });

    it('renders English UI text when isVi=false', () => {
      render(<DashboardSidebarNav isVi={false} />);
      expect(screen.getByText('Platform Navigation')).toBeDefined();
      expect(screen.getByText('Upgrade Tier')).toBeDefined();
    });

    it('conditionally displays admin console with bilingual header when isAdmin=true', () => {
      const { rerender } = render(<DashboardSidebarNav isAdmin={true} isVi={false} />);
      expect(screen.getByText('Admin Console')).toBeDefined();
      expect(screen.getByText('Handover Console')).toBeDefined();
      expect(screen.getByText('Ops Dashboard')).toBeDefined();

      rerender(<DashboardSidebarNav isAdmin={true} isVi={true} />);
      expect(screen.getByText('Bảng Quản Trị')).toBeDefined();
    });

    it('hides admin console completely when isAdmin=false', () => {
      render(<DashboardSidebarNav isAdmin={false} />);
      expect(screen.queryByText('Admin Console')).toBeNull();
      expect(screen.queryByText('Bảng Quản Trị')).toBeNull();
      expect(screen.queryByText('Handover Console')).toBeNull();
      expect(screen.queryByText('Ops Dashboard')).toBeNull();
    });
  });
});
