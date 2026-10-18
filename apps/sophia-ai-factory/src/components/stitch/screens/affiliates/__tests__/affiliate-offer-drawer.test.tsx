/**
 * Unit & Integration tests for AffiliateOfferDrawer component (Rendering & Tracking Link).
 *
 * Verifies:
 * 1. Accessible drawer rendering with role="dialog", aria-modal="true"
 * 2. Full commission terms, cookie window, minimum payout, and destination link
 * 3. Dynamic tracking link generator with optional sub-ID and clipboard copy
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AffiliateOfferDrawer } from '../affiliate-offer-drawer';
import type { AffiliateOffer } from '@/seed/types/affiliate';

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

describe('AffiliateOfferDrawer Rendering & Tracking Link', () => {
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

    expect(screen.getByText('SEMrush SEO Toolkit')).toBeDefined();
    expect(screen.getByText('40% Recurring Monthly')).toBeDefined();
    expect(screen.getByText('stitch.affiliates.drawer.cookieWindow')).toBeDefined();
    expect(screen.getByText('stitch.affiliates.drawer.days:{"days":120}')).toBeDefined();
    expect(screen.getByText('$50.00 USD')).toBeDefined();
    expect(screen.getByText('https://www.semrush.com/lp/affiliate-program/')).toBeDefined();
  });

  it('generates live tracking URL and updates when subId is typed', () => {
    render(<AffiliateOfferDrawer isOpen={true} offer={mockOffer} onClose={vi.fn()} />);

    const subIdInput = screen.getByLabelText('stitch.affiliates.drawer.subIdLabel');
    expect(subIdInput).toBeDefined();

    const trackingUrlInput = screen.getByDisplayValue(
      'https://www.semrush.com/lp/affiliate-program/?via=sophia'
    );
    expect(trackingUrlInput).toBeDefined();

    fireEvent.change(subIdInput, { target: { value: 'yt_shorts_01' } });
    expect(
      screen.getByDisplayValue(
        'https://www.semrush.com/lp/affiliate-program/?via=sophia&sub_id=yt_shorts_01'
      )
    ).toBeDefined();
  });

  it('copies generated tracking URL to clipboard on Copy button click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
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
});
