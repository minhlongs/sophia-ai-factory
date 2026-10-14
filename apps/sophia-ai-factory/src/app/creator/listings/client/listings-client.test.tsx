// i18n-namespace: marketplace.creator

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListingsClient, STATUS_COLORS } from './index';
import type { SopListingView } from '@/land/sop-marketplace';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/land/sop-marketplace', () => ({
  publishListing: vi.fn(),
  archiveListing: vi.fn(),
}));

describe('ListingsClient', () => {
  it('renders empty listings state when no initial listings', () => {
    render(<ListingsClient initialListings={[]} />);
    expect(screen.getByText('noListings')).toBeDefined();
    expect(screen.getAllByText('createListing').length).toBeGreaterThan(0);
  });

  it('renders table rows when listings are provided', () => {
    const mockListings: SopListingView[] = [
      {
        id: 'list-1',
        title: 'Automation Workflow',
        description: 'Test workflow',
        priceCents: 5000,
        priceDisplay: '$50.00',
        category: 'agency',
        tags: ['agency'],
        thumbnailUrl: null,
        demovideoUrl: null,
        sopTemplateId: 'sop-1',
        creatorId: 'user-1',
        status: 'published',
        installCount: 12,
        rating: 4.8,
        createdAt: 1704067200,
      },
    ];

    render(<ListingsClient initialListings={mockListings} />);
    expect(screen.getByText('Automation Workflow')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('$50.00')).toBeDefined();
  });

  it('provides status color mapping', () => {
    expect(STATUS_COLORS.published).toBeDefined();
    expect(STATUS_COLORS.draft).toBeDefined();
    expect(STATUS_COLORS.archived).toBeDefined();
  });
});
