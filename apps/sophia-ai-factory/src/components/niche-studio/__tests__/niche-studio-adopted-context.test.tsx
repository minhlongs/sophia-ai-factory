/**
 * Niche Studio Adopted-Campaign Context Tests
 *
 * Verifies that adopting an affiliate offer lands the customer in the campaign
 * workspace carrying the offer and campaign identity, instead of dropping them
 * onto an unrelated template screen.
 * @module components/niche-studio/__tests__/niche-studio-adopted-context
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const searchParamsGet = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGet }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `trans_${key}`,
}));

vi.mock('@/tree/video/syndication/niche-syndication-builder', () => ({
  buildNicheSyndicationPackage: () => null,
}));

vi.mock('@/tree/video/ab-testing/niche-hook-variant-generator', () => ({
  generateHookVariants: () => ({ variants: [], recommendedVariantId: null }),
}));

vi.mock('../niche-studio-header', () => ({
  NicheStudioHeader: () => <div data-testid="header" />,
}));

vi.mock('../niche-campaign-form', () => ({
  NicheCampaignForm: () => <div data-testid="campaign-form" />,
}));

vi.mock('../niche-conversion-stats-card', () => ({
  NicheConversionStatsCard: () => <div data-testid="stats" />,
}));

vi.mock('../storyboard-preview-card', () => ({
  StoryboardPreviewCard: () => <div data-testid="storyboard" />,
}));

vi.mock('../video-compliance-preview-player', () => ({
  VideoCompliancePreviewPlayer: () => <div data-testid="player" />,
}));

vi.mock('../niche-syndication-preview-card', () => ({
  NicheSyndicationPreviewCard: () => <div data-testid="syndication" />,
}));

vi.mock('../niche-hook-variants-card', () => ({
  NicheHookVariantsCard: () => <div data-testid="hooks" />,
}));

import { NicheStudioView } from '../niche-studio-view';

describe('NicheStudioView adopted-campaign context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the adopted offer and campaign identity when arriving from an offer', () => {
    searchParamsGet.mockImplementation((key: string) => {
      if (key === 'campaignId') return 'camp_abc123';
      if (key === 'offerName') return 'SEMrush SEO Toolkit';
      return null;
    });

    render(<NicheStudioView />);

    expect(screen.getByText('trans_adoptedCampaignContext')).toBeDefined();
    expect(screen.getByText('SEMrush SEO Toolkit')).toBeDefined();
    expect(screen.getByText('#camp_abc123')).toBeDefined();
  });

  it('falls back to the campaign id when the offer name is absent', () => {
    searchParamsGet.mockImplementation((key: string) => {
      if (key === 'campaignId') return 'camp_xyz789';
      return null;
    });

    render(<NicheStudioView />);

    expect(screen.getByText('camp_xyz789')).toBeDefined();
    expect(screen.queryByText('trans_adoptedCampaignContext')).not.toBeNull();
  });

  it('renders no adopted-campaign banner on a cold entry', () => {
    searchParamsGet.mockReturnValue(null);

    render(<NicheStudioView />);

    expect(screen.queryByText('trans_adoptedCampaignContext')).toBeNull();
    expect(screen.getByTestId('campaign-form')).toBeDefined();
  });
});
