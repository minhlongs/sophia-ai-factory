/**
 * Unit & Integration tests for AffiliateOfferDrawer campaign adoption & dismissal actions.
 *
 * Verifies:
 * 1. 1-Click Campaign Adoption into Creator Studio (dispatches adoptAffiliateOfferAction)
 * 2. 1-Click Campaign Adoption into Distribution Queue
 * 3. Keyboard Escape key dismissal and close button interaction
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AffiliateOfferDrawer } from '../affiliate-offer-drawer';
import type { AffiliateOffer } from '@/seed/types/affiliate';
import * as affiliateActions from '@/forest/actions/affiliate-actions';

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${namespace || ''}.${key}:${JSON.stringify(params)}`;
    return `${namespace || ''}.${key}`;
  },
  useLocale: () => 'en',
}));

vi.mock('@/forest/actions/affiliate-actions', () => ({
  adoptAffiliateOfferAction: vi.fn(),
}));

const mockOffer: AffiliateOffer = {
  id: 'semrush',
  programName: 'SEMrush SEO Toolkit',
  category: 'SaaS',
  payoutModel: 'Recurring',
  commissionRatePct: 40.0,
  commissionTerms: '40% Recurring Monthly',
  epc: 18.0,
  conversionRatePct: 4.8,
  qualityScore: 9.8,
  destinationUrl: 'https://www.semrush.com/lp/affiliate-program/',
  cookieWindowDays: 120,
  minPayoutUsd: 50.0,
  status: 'active',
};

describe('AffiliateOfferDrawer Actions & Dismissal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches adoptAffiliateOfferAction when "Adopt into Creator Studio" is clicked', async () => {
    const adoptMock = vi.mocked(affiliateActions.adoptAffiliateOfferAction).mockResolvedValue({
      success: true,
      campaignId: 'camp_98765',
      target: 'creator_studio',
      deepLink: '/creator/studio?offerId=semrush&campaignId=camp_98765',
      message: 'Adopted into Creator Studio',
    });
    const onAdoptSuccess = vi.fn();

    render(
      <AffiliateOfferDrawer
        isOpen={true}
        offer={mockOffer}
        onClose={vi.fn()}
        onAdoptSuccess={onAdoptSuccess}
      />
    );

    const adoptStudioButton = screen.getByRole('button', {
      name: 'stitch.affiliates.drawer.adoptCreatorStudio',
    });
    fireEvent.click(adoptStudioButton);

    await waitFor(() => {
      expect(adoptMock).toHaveBeenCalledWith({
        offerId: 'semrush',
        target: 'creator_studio',
        campaignName: 'SEMrush SEO Toolkit',
      });
      expect(onAdoptSuccess).toHaveBeenCalledWith({
        target: 'creator_studio',
        campaignId: 'camp_98765',
        deepLink: '/creator/studio?offerId=semrush&campaignId=camp_98765',
      });
      expect(
        screen.getByText('stitch.affiliates.drawer.adoptedCreatorSuccess:{"campaignId":"camp_98765"}')
      ).toBeDefined();
    });
  });

  it('dispatches adoptAffiliateOfferAction when "Queue for Distribution" is clicked', async () => {
    const adoptMock = vi.mocked(affiliateActions.adoptAffiliateOfferAction).mockResolvedValue({
      success: true,
      campaignId: 'camp_54321',
      target: 'distribution_queue',
      deepLink: '/creator/studio?tab=queue&campaignId=camp_54321',
      message: 'Queued for distribution',
    });

    render(<AffiliateOfferDrawer isOpen={true} offer={mockOffer} onClose={vi.fn()} />);

    const queueButton = screen.getByRole('button', {
      name: 'stitch.affiliates.drawer.queueDistribution',
    });
    fireEvent.click(queueButton);

    await waitFor(() => {
      expect(adoptMock).toHaveBeenCalledWith({
        offerId: 'semrush',
        target: 'distribution_queue',
        campaignName: 'SEMrush SEO Toolkit',
      });
      expect(
        screen.getByText('stitch.affiliates.drawer.queuedSuccess:{"campaignId":"camp_54321"}')
      ).toBeDefined();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<AffiliateOfferDrawer isOpen={true} offer={mockOffer} onClose={handleClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'stitch.affiliates.drawer.close' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<AffiliateOfferDrawer isOpen={true} offer={mockOffer} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
