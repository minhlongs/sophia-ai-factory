/**
 * @file fleet-matrix-radar-cards.test.tsx
 * @description Unit tests for Fleet Matrix & Trending SKU Radar UI components
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FleetMatrixCard } from '../fleet-matrix-card';
import { TrendingSkuRadarCard } from '../trending-sku-radar-card';
import type { FleetCreatorAccount, TrendingSkuRadarItem } from '@/seed/types/fleet-matrix-sku-radar-types';

describe('Fleet Matrix & SKU Radar UI Cards (Presentation Layer)', () => {
  const mockAccounts: FleetCreatorAccount[] = [
    {
      id: 'acc-1',
      userId: 'usr-1',
      platform: 'TIKTOK',
      handle: '@ai_review_hub',
      displayName: 'AI Review Hub',
      proxyConfigId: null,
      status: 'ACTIVE',
      dailyPostLimit: 4,
      postsPublishedToday: 2,
      lastPostAt: null,
      totalViews: 45000,
      totalClicks: 1500,
      totalGmv: 12000000,
      totalCommission: 2400000,
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  const mockRadarItems: TrendingSkuRadarItem[] = [
    {
      id: 'radar-1',
      platform: 'TIKTOK_SHOP',
      skuCode: 'SKU-SMARTWATCH-ULTRA',
      productName: 'Smartwatch Ultra Series 9',
      productCategory: 'ELECTRONICS',
      price: 890000,
      currency: 'VND',
      commissionRate: 0.35,
      estimatedCommission: 311500,
      dailySalesVolume: 2500,
      growthVelocityScore: 92,
      hotTrendTier: 'BREAKOUT',
      affiliateUrl: 'https://tiktok.com/shop/p/SKU-SMARTWATCH-ULTRA',
      topSellingHookSummary: 'Chiếc đồng hồ pin 7 ngày giá chỉ 800k?',
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  it('renders FleetMatrixCard and handles account selection for deployment', () => {
    const handleDeploy = vi.fn();
    render(<FleetMatrixCard accounts={mockAccounts} onDeployCampaign={handleDeploy} />);

    expect(screen.getByText('Ma Trận Tài Khoản Fleet (Anti-Shadowban)')).toBeDefined();
    expect(screen.getByText('AI Review Hub')).toBeDefined();
    expect(screen.getByText('2/4 posts')).toBeDefined();

    // Click account to select
    const accountItem = screen.getByText('AI Review Hub');
    fireEvent.click(accountItem);

    // Click deploy button
    const deployBtn = screen.getByRole('button', { name: /Phát Hành Staggered/i });
    fireEvent.click(deployBtn);

    expect(handleDeploy).toHaveBeenCalledWith(['acc-1']);
  });

  it('renders TrendingSkuRadarCard and triggers 1-Click campaign launch', () => {
    const handleOneClick = vi.fn();
    render(<TrendingSkuRadarCard radarItems={mockRadarItems} onOneClickLaunch={handleOneClick} />);

    expect(screen.getByText('Radar SKU Bùng Nổ (Velocity Score)')).toBeDefined();
    expect(screen.getByText('Smartwatch Ultra Series 9')).toBeDefined();
    expect(screen.getByText('92/100')).toBeDefined();
    expect(screen.getByText('TIER: BREAKOUT')).toBeDefined();

    const launchBtn = screen.getByRole('button', { name: /1-Click Tạo Campaign & Bridge Page Ngay/i });
    fireEvent.click(launchBtn);

    expect(handleOneClick).toHaveBeenCalledWith(mockRadarItems[0]);
  });
});
