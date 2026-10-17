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

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
}));

vi.mock('@/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('Stitch Phase 2 UI Preview Components', () => {
  it('renders DashboardControlDeckBanner (Screen 1)', () => {
    render(<DashboardControlDeckBanner />);
    expect(screen.getByTestId('dashboard-control-deck-banner')).toBeDefined();
    expect(screen.getByText(/STITCH v4\.2/i)).toBeDefined();
  });

  it('renders StitchStudioDeckStrip (Screens 2 & 3)', () => {
    render(<StitchStudioDeckStrip />);
    expect(screen.getByTestId('stitch-studio-deck-strip')).toBeDefined();
    expect(screen.getByText(/PHÒNG DỰNG VIDEO AI · BẢN XEM TRƯỚC/i)).toBeDefined();
  });

  it('renders MerkleSettlementBanner (Screen 4)', () => {
    render(
      <MerkleSettlementBanner
        partnerCode="SOPHIA_VIP"
        commissionRatePct={30}
        locale="vi"
      />,
    );
    expect(screen.getByTestId('stitch-merkle-settlement-banner')).toBeDefined();
    expect(screen.getByText(/30% HOA HỒNG · SOPHIA_VIP/i)).toBeDefined();
  });

  it('renders StitchByokVaultBanner (Screen 5)', () => {
    render(<StitchByokVaultBanner />);
    expect(screen.getByTestId('stitch-byok-vault-banner')).toBeDefined();
    expect(screen.getByRole('link', { name: /Quản Lý Khóa BYOK/i })).toBeDefined();
  });

  it('renders StitchAgencySubaccountStrip (Screen 6)', () => {
    render(<StitchAgencySubaccountStrip isVi={true} />);
    expect(screen.getByTestId('stitch-agency-subaccount-strip')).toBeDefined();
    expect(screen.getByText(/BẢN MẪU GIAO DIỆN/i)).toBeDefined();
  });

  it('renders StitchMobileCompanionBanner (Screen 7)', () => {
    render(<StitchMobileCompanionBanner />);
    expect(screen.getByTestId('stitch-mobile-companion-banner')).toBeDefined();
    expect(screen.getByText(/TRẢI NGHIỆM DI ĐỘNG · BẢN XEM TRƯỚC/i)).toBeDefined();
  });

  it('renders PricingRoiCalculator and updates savings when slider changes (Screen 8)', () => {
    render(<PricingRoiCalculator />);
    expect(screen.getByTestId('stitch-pricing-roi-calculator')).toBeDefined();
    expect(screen.getByText('$199/mo')).toBeDefined();
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(screen.getByText(/60 video\/tháng/i)).toBeDefined();
  });
});
