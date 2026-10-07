/**
 * Unit & Integration tests for AffiliateOfferDrawer component.
 *
 * Verifies:
 * 1. Accessible drawer rendering with role="dialog", aria-modal="true"
 * 2. Full commission terms, cookie window, minimum payout, and destination link
 * 3. Dynamic tracking link generator with optional sub-ID and clipboard copy
 * 4. 1-Click Campaign Adoption into Creator Studio (dispatches adoptAffiliateOfferAction)
 * 5. 1-Click Campaign Adoption into Distribution Queue
 * 6. Keyboard Escape key dismissal and close button interaction
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AffiliateOfferDrawer } from '../affiliate-offer-drawer';
import type { AffiliateOffer } from '@/seed/types/affiliate';
import * as affiliateActions from '@/forest/actions/affiliate-actions';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${namespace || ''}.${key}:${JSON.stringify(params)}`;
    }
    return `${namespace || ''}.${key}`;
  },
  useLocale: () => 'en',
}));

// Mock adoptAffiliateOfferAction
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

describe('AffiliateOfferDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<AffiliateOfferDrawer isOpen={false} offer={mockOffer} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not render when offer is null', () => {
    render(<AffiliateOfferDrawer isOpen={true} offer={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders accessible drawer dialog with terms and cookie window', () => {
    render(<AffiliateOfferDrawer isOpen={true} offer={mockOffer} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // Title and commission terms
    expect(screen.getByText('SEMrush SEO Toolkit')).toBeDefined();
    expect(screen.getByText('40% Recurring Monthly')).toBeDefined();

    // Cookie window and payout minimum
    expect(screen.getByText('stitch.affiliates.drawer.cookieWindow')).toBeDefined();
    expect(screen.getByText('stitch.affiliates.drawer.days:{"days":120}')).toBeDefined();
    expect(screen.getByText('$50.00 USD')).toBeDefined();
    expect(screen.getByText('https://www.semrush.com/lp/affiliate-program/')).toBeDefined();
  });

  it('generates live tracking URL and updates when subId is typed', () => {
    render(<AffiliateOfferDrawer isOpen={true} offer={mockOffer} onClose={vi.fn()} />);

    const subIdInput = screen.getByLabelText('stitch.affiliates.drawer.subIdLabel');
    expect(subIdInput).toBeDefined();

    // Default tracking URL without subId
    const trackingUrlInput = screen.getByDisplayValue(
      'https://www.semrush.com/lp/affiliate-program/?via=sophia'
    );
    expect(trackingUrlInput).toBeDefined();

    // Enter sub-ID
    fireEvent.change(subIdInput, { target: { value: 'yt_shorts_01' } });

    // Tracking URL should update reactively
    expect(
      screen.getByDisplayValue(
        'https://www.semrush.com/lp/affiliate-program/?via=sophia&sub_id=yt_shorts_01'
      )
    ).toBeDefined();
  });

  it('copies generated tracking URL to clipboard on Copy button click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<AffiliateOfferDrawer isOpen={true} offer={mockOffer} onClose={vi.fn()} />);

    const copyButton = screen.getByRole('button', {
      name: 'stitch.affiliates.drawer.copyLink',
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        'https://www.semrush.com/lp/affiliate-program/?via=sophia'
      );
      expect(screen.getByText('stitch.affiliates.drawer.copied')).toBeDefined();
    });
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

    const closeButton = screen.getByRole('button', {
      name: 'stitch.affiliates.drawer.close',
    });
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<AffiliateOfferDrawer isOpen={true} offer={mockOffer} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
