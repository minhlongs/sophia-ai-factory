/**
 * @file sku-velocity-calculator.test.ts
 * @description Unit tests for Trending SKU Velocity Calculator
 */

import { describe, it, expect } from 'vitest';
import { calculateSkuVelocity } from '../sku-velocity-calculator';

describe('Trending SKU Velocity Calculator', () => {
  it('identifies BREAKOUT tier for high-growth high-commission items', () => {
    const result = calculateSkuVelocity({
      skuCode: 'SKU-HEADPHONE-X9',
      platform: 'TIKTOK_SHOP',
      productName: 'Tai Nghe Không Dây X9',
      price: 350000,
      commissionRate: 0.3, // 30%
      salesVolume24h: 850,
      salesVolumeBaseline24h: 150, // +466% growth
      viewCount24h: 12000,
    });

    expect(result.velocityScore).toBeGreaterThanOrEqual(80);
    expect(result.hotTrendTier).toBe('BREAKOUT');
    expect(result.estimatedCommissionPerOrder).toBe(105000);
    expect(result.oneClickCampaignRecommendation.recommendedHooks.length).toBe(5);
  });

  it('classifies steady or cooling items accurately', () => {
    const result = calculateSkuVelocity({
      skuCode: 'SKU-OLD-CABLE',
      platform: 'SHOPEE',
      productName: 'Cáp Sạc Cũ',
      price: 50000,
      commissionRate: 0.05, // 5%
      salesVolume24h: 10,
      salesVolumeBaseline24h: 20, // -50%
      viewCount24h: 1000,
    });

    expect(result.velocityScore).toBeLessThan(35);
    expect(result.hotTrendTier).toBe('COOLING');
    expect(result.growthRatePercentage).toBe(-50);
  });
});
