/**
 * Unit & Integration tests for AffiliateDiscoveryPanel component (Rendering & Filtering).
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
  {
    id: 'pandadoc',
    programName: 'PandaDoc Documents',
    category: 'Agency Automation',
    payoutModel: 'RevShare %',
    commissionRatePct: 35.0,
    commissionTerms: '35% RevShare on Contract Values',
    epc: 8.3,
    conversionRatePct: 3.2,
    qualityScore: 9.1,
    destinationUrl: 'https://pandadoc.com/affiliate',
    cookieWindowDays: 90,
    minPayoutUsd: 50.0,
    status: 'active',
  },
];

vi.mock('@/forest/actions/affiliate-actions', () => ({
  getAffiliateOffersAction: vi.fn().mockImplementation(async (filters) => {
    let list = [...mockOffers];
    if (filters?.category && filters.category !== 'all') {
      list = list.filter((o) => o.category.toLowerCase() === filters.category.toLowerCase());
    }
    if (filters?.payoutModel && filters.payoutModel !== 'all') {
      list = list.filter((o) => o.payoutModel.toLowerCase() === filters.payoutModel.toLowerCase());
    }
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

describe('AffiliateDiscoveryPanel Filtering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all initial offers and panel header', async () => {
    render(<AffiliateDiscoveryPanel initialOffers={mockOffers} />);
    expect(screen.getByText('stitch.affiliates.discovery.title')).toBeDefined();
    expect(screen.getByText('SEMrush SEO Toolkit')).toBeDefined();
    expect(screen.getByText('Shopify E-Commerce')).toBeDefined();
    expect(screen.getByText('Canva Pro Design')).toBeDefined();
    expect(screen.getByText('PandaDoc Documents')).toBeDefined();
  });

  it('filters offers by category when a category pill is clicked', async () => {
    render(<AffiliateDiscoveryPanel initialOffers={mockOffers} />);
    fireEvent.click(screen.getByRole('button', { name: 'stitch.affiliates.discovery.categories.saas' }));
    await waitFor(() => {
      expect(screen.getByText('SEMrush SEO Toolkit')).toBeDefined();
      expect(screen.queryByText('Shopify E-Commerce')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'stitch.affiliates.discovery.categories.creatorTools' }));
    await waitFor(() => {
      expect(screen.getByText('Canva Pro Design')).toBeDefined();
      expect(screen.queryByText('SEMrush SEO Toolkit')).toBeNull();
    });
  });

  it('filters offers by payout model when a payout model pill is clicked', async () => {
    render(<AffiliateDiscoveryPanel initialOffers={mockOffers} />);
    fireEvent.click(screen.getByRole('button', { name: 'stitch.affiliates.discovery.payoutModels.cpa' }));
    await waitFor(() => {
      expect(screen.getByText('Shopify E-Commerce')).toBeDefined();
      expect(screen.getByText('Canva Pro Design')).toBeDefined();
      expect(screen.queryByText('SEMrush SEO Toolkit')).toBeNull();
    });
  });

  it('filters offers by search query text input', async () => {
    render(<AffiliateDiscoveryPanel initialOffers={mockOffers} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Shopify' } });
    await waitFor(() => {
      expect(screen.getByText('Shopify E-Commerce')).toBeDefined();
      expect(screen.queryByText('SEMrush SEO Toolkit')).toBeNull();
    });
  });
});
