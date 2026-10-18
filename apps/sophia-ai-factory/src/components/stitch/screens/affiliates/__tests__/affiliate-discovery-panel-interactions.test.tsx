/**
 * Unit & Integration tests for AffiliateDiscoveryPanel interactions (Sorting, Empty State, Drawer).
 *
 * Verifies:
 * 1. Empty state and "Reset Filters" action
 * 2. Multi-attribute sorting (EPC, Conversion Rate, Commission Rate, Quality Score)
 * 3. Responsive grid layout container classes (1 col mobile, 2 col tablet, 3 col desktop)
 * 4. Slide-over drawer open and close interactions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AffiliateDiscoveryPanel } from '../affiliate-discovery-panel';
import type { AffiliateOffer } from '@/seed/types/affiliate';

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${namespace || ''}.${key}:${JSON.stringify(params)}`;
    return `${namespace || ''}.${key}`;
  },
  useLocale: () => 'en',
}));

const mockOffers: AffiliateOffer[] = [
  {
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
  },
  {
    id: 'shopify',
    programName: 'Shopify E-Commerce',
    category: 'E-Commerce',
    payoutModel: 'Flat CPA',
    commissionRatePct: 100.0,
    commissionTerms: '$150 Flat Bounty per Merchant',
    epc: 22.5,
    conversionRatePct: 5.2,
    qualityScore: 9.9,
    destinationUrl: 'https://www.shopify.com/affiliates',
    cookieWindowDays: 30,
    minPayoutUsd: 25.0,
    status: 'active',
  },
  {
    id: 'canva',
    programName: 'Canva Pro Design',
    category: 'Creator Tools',
    payoutModel: 'Flat CPA',
    commissionRatePct: 80.0,
    commissionTerms: '$36 Pro / $80 Enterprise Flat',
    epc: 14.2,
    conversionRatePct: 6.5,
    qualityScore: 9.6,
    destinationUrl: 'https://www.canva.com/affiliates/',
    cookieWindowDays: 30,
    minPayoutUsd: 10.0,
    status: 'active',
  },
];

vi.mock('@/forest/actions/affiliate-actions', () => ({
  getAffiliateOffersAction: vi.fn().mockImplementation(async (filters) => {
    let list = [...mockOffers];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((o) => o.programName.toLowerCase().includes(q));
    }
    return { success: true, offers: list, total: list.length };
  }),
  adoptAffiliateOfferAction: vi.fn().mockResolvedValue({
    success: true,
    campaignId: 'camp_12345',
    target: 'creator_studio',
    deepLink: '/creator/studio?offerId=semrush&campaignId=camp_12345',
    message: 'Offer successfully adopted',
  }),
}));

describe('AffiliateDiscoveryPanel Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders clean empty state with reset filters button when no offers match', async () => {
    render(<AffiliateDiscoveryPanel initialOffers={mockOffers} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'NonExistentProgramXYZ' } });
    await waitFor(() => {
      expect(screen.getByText('stitch.affiliates.discovery.emptySearch')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'stitch.affiliates.discovery.resetFilters' }));
    await waitFor(() => {
      expect(screen.getByText('SEMrush SEO Toolkit')).toBeDefined();
      expect(screen.getByText('Shopify E-Commerce')).toBeDefined();
    });
  });

  it('sorts offers when sorting dropdown value changes', async () => {
    render(<AffiliateDiscoveryPanel initialOffers={mockOffers} />);

    const sortSelect = screen.getByRole('combobox', {
      name: 'stitch.affiliates.discovery.sort.label',
    });

    fireEvent.change(sortSelect, { target: { value: 'conversion' } });
    await waitFor(() => {
      const titles = screen.getAllByRole('heading', { level: 4 });
      expect(titles[0].textContent).toContain('Canva Pro Design');
    });

    fireEvent.change(sortSelect, { target: { value: 'commission' } });
    await waitFor(() => {
      const titles = screen.getAllByRole('heading', { level: 4 });
      expect(titles[0].textContent).toContain('Shopify E-Commerce');
    });
  });

  it('enforces responsive grid container layout classes', () => {
    const { container } = render(<AffiliateDiscoveryPanel initialOffers={mockOffers} />);
    const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
    expect(grid).toBeDefined();
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('md:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-3');
  });

  it('opens and closes AffiliateOfferDrawer on card trigger', async () => {
    render(<AffiliateDiscoveryPanel initialOffers={mockOffers} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    const adoptButtons = screen.getAllByRole('button', {
      name: 'stitch.affiliates.discovery.card.adoptOffer',
    });
    fireEvent.click(adoptButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('stitch.affiliates.drawer.title')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'stitch.affiliates.drawer.close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
