import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunbookSovereignStatusStrip } from '@/forest/components/runbooks/runbook-sovereign-status-strip';
import { StitchRouteBanner } from '@/components/stitch/ui/stitch-route-banner';
import { ControlDeckHub } from '@/components/stitch/screens/control-deck/control-deck-hub';
import { computeLiveControlDeckDataset } from '@/tree/control-deck';
import { SOPHIA_NAV_MODULES } from '@/forest/dashboard/dashboard-nav-modules';

vi.mock('@/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/vi/dashboard/docs/runbooks',
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
}));

describe('RunbookSovereignStatusStrip & Clean UI Architecture', () => {
  it('renders live D1 telemetry in Vietnamese and never embeds an iframe', () => {
    const { container } = render(
      <RunbookSovereignStatusStrip
        isVi={true}
        handoverStatus="accepted"
        certificateHash="a1b2c3d4e5f6000011112222"
        installedSopCount={7}
        readinessScore={100}
        readyForMissions={true}
      />,
    );

    expect(screen.getByText(/D1 TRỰC TUYẾN · CHỦ QUYỀN 100%/i)).toBeDefined();
    expect(screen.getByText(/ĐÃ BÀN GIAO & KÝ/i)).toBeDefined();
    expect(screen.getByText(/SOP đã cài: 7/i)).toBeDefined();
    expect(screen.getByText(/Sẵn sàng: 100%/i)).toBeDefined();
    expect(screen.getByText(/SHA: a1b2c3d4e5f6…/i)).toBeDefined();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('renders StitchRouteBanner without any legacy /stitch/*.html iframe', () => {
    const { container } = render(
      <StitchRouteBanner
        testId="stitch-handover-banner"
        ariaLabel="Handover Status"
        badgeText="SOVEREIGN"
        title="Test Banner"
        description="Clean React UI without iframe"
        ctaHref="/dashboard/handover"
        ctaLabel="Open Handover"
      />,
    );

    expect(screen.getByText('Test Banner')).toBeDefined();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('renders ControlDeckHub with zero iframes', () => {
    const dataset = computeLiveControlDeckDataset();
    const { container } = render(<ControlDeckHub dataset={dataset} initialLang="vi" />);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('keeps all 16 SOPHIA_NAV_MODULES pointing to valid app routes', () => {
    expect(SOPHIA_NAV_MODULES.length).toBe(16);
    const routes = SOPHIA_NAV_MODULES.map((m) => m.href);
    expect(routes).toContain('/dashboard/sop-marketplace');
    expect(routes).toContain('/marketplace');
    expect(routes).toContain('/dashboard/handover');
    expect(routes).toContain('/dashboard/docs/runbooks');
  });
});
