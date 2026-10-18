import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardControlDeckBanner } from '@/components/stitch/screens/dashboard/dashboard-control-deck-banner';
import { PricingRoiCalculator } from '@/components/stitch/screens/pricing/view/pricing-roi-calculator';
import { MerkleSettlementBanner } from '@/app/components/affiliate/dashboard/merkle-settlement-banner';
import { StitchStudioDeckStrip } from '@/components/missions/stitch-studio-deck-strip';
import { StitchByokVaultBanner } from '@/components/stitch/screens/settings/stitch-byok-vault-banner';
import { StitchAgencySubaccountStrip } from '@/app/[locale]/partner/stitch-agency-subaccount-strip';
import { StitchMobileCompanionBanner } from '@/components/approval-queue/stitch-mobile-companion-banner';
import { StitchWave2RouteBanner } from '@/components/stitch/screens/control-deck/stitch-wave2-route-banner';
import {
  resolveRouteBannerCopy,
  STITCH_WAVE2_ROUTE_BANNER_SPECS,
  type StitchWave2RouteBannerKey,
} from '@/tree/control-deck/route-banner-specs';

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
}));

vi.mock('@/navigation', () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('Stitch Phase 2 UI Preview Components', () => {
  it('renders DashboardControlDeckBanner with data-testid and accessible region (Screen 1)', () => {
    render(<DashboardControlDeckBanner />);
    const banner = screen.getByTestId('dashboard-control-deck-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByText(/STITCH v4\.2/i)).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/control-deck');
  });

  it('renders StitchStudioDeckStrip with data-testid and accessible region (Screens 2 & 3)', () => {
    render(<StitchStudioDeckStrip />);
    const strip = screen.getByTestId('stitch-studio-deck-strip');
    expect(strip).toBeDefined();
    expect(strip.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByText(/PHÒNG DỰNG VIDEO AI · BẢN XEM TRƯỚC/i)).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/control-deck');
  });

  it('renders MerkleSettlementBanner with data-testid and accessible region (Screen 4)', () => {
    render(
      <MerkleSettlementBanner
        partnerCode="SOPHIA_VIP"
        commissionRatePct={30}
        locale="vi"
      />,
    );
    const banner = screen.getByTestId('stitch-merkle-settlement-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByText(/30% HOA HỒNG · SOPHIA_VIP/i)).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/control-deck');
  });

  it('renders StitchByokVaultBanner with data-testid and accessible region (Screen 5)', () => {
    render(<StitchByokVaultBanner />);
    const banner = screen.getByTestId('stitch-byok-vault-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Quản Lý Khóa BYOK/i })).toBeDefined();
  });

  it('renders StitchAgencySubaccountStrip with data-testid and accessible region (Screen 6)', () => {
    render(<StitchAgencySubaccountStrip isVi={true} />);
    const strip = screen.getByTestId('stitch-agency-subaccount-strip');
    expect(strip).toBeDefined();
    expect(strip.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByText(/BẢN MẪU GIAO DIỆN/i)).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/control-deck');
  });

  it('renders StitchMobileCompanionBanner with data-testid and accessible region (Screen 7)', () => {
    render(<StitchMobileCompanionBanner />);
    const banner = screen.getByTestId('stitch-mobile-companion-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByText(/TRẢI NGHIỆM DI ĐỘNG · BẢN XEM TRƯỚC/i)).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/control-deck');
  });

  it('renders PricingRoiCalculator with aria-labelledby and updates savings when slider changes (Screen 8)', () => {
    render(<PricingRoiCalculator />);
    const calc = screen.getByTestId('stitch-pricing-roi-calculator');
    expect(calc).toBeDefined();
    expect(calc.getAttribute('aria-labelledby')).toBe('stitch-roi-calculator-heading');
    expect(screen.getByText('$199/mo')).toBeDefined();
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(screen.getByText(/60 video\/tháng/i)).toBeDefined();
  });

  it('renders StitchWave2RouteBanner across all 9 Wave 2 route keys with bilingual copy (Screens 10–18)', () => {
    const wave2Keys = Object.keys(STITCH_WAVE2_ROUTE_BANNER_SPECS) as StitchWave2RouteBannerKey[];
    expect(wave2Keys).toHaveLength(9);

    for (const key of wave2Keys) {
      const viCopy = resolveRouteBannerCopy(key, true);
      const enCopy = resolveRouteBannerCopy(key, false);
      expect(viCopy.title).not.toBe(enCopy.title);
      expect(viCopy.ctaHref).toBe('/dashboard/control-deck');

      const { unmount } = render(<StitchWave2RouteBanner routeKey={key} />);
      const banner = screen.getByTestId(`stitch-wave2-route-banner-${key}`);
      expect(banner.getAttribute('aria-label')).toBe(viCopy.ariaLabel);
      expect(screen.getByText(viCopy.badge)).toBeDefined();
      unmount();
    }
  });
});
