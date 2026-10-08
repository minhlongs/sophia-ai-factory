/**
 * @file sku-velocity-calculator.ts
 * @description Real-time Trending SKU Velocity Score & Hot-Trend Tier Classifier
 * @layer tree
 */

import type { HotTrendTier, RadarPlatform } from '@/seed/types/fleet-matrix-sku-radar-types';

export interface SkuMetricsInput {
  skuCode: string;
  platform: RadarPlatform;
  productName: string;
  price: number;
  commissionRate: number; // e.g. 0.25 for 25%
  salesVolume24h: number;
  salesVolumeBaseline24h: number;
  viewCount24h?: number;
}

export interface SkuVelocityResult {
  skuCode: string;
  velocityScore: number; // 0 - 100
  hotTrendTier: HotTrendTier;
  growthRatePercentage: number;
  conversionRatePercentage: number;
  estimatedCommissionPerOrder: number;
  oneClickCampaignRecommendation: {
    recommendedHooks: string[];
    urgencyText: string;
    targetAudience: string;
  };
}

function classifyTier(score: number): HotTrendTier {
  if (score >= 80) return 'BREAKOUT';
  if (score >= 60) return 'SURGING';
  if (score >= 35) return 'STEADY';
  return 'COOLING';
}

function generateHookAngles(productName: string, tier: HotTrendTier, commissionPct: number): string[] {
  return [
    `😱 Đừng mua ${productName} nếu bạn chưa biết sự thật sốc này!`,
    `Review chân thực: Liệu ${productName} có thực sự đáng tiền như lời đồn?`,
    `Cách mình tiết kiệm 40% chi phí với ${productName} chỉ sau 3 ngày!`,
    `Top 3 lý do ${productName} đang cháy hàng toàn quốc tuần này.`,
    `Bí mật giới hạn: Deal trợ giá độc quyền ${commissionPct}% chỉ có hôm nay!`,
  ];
}

export function calculateSkuVelocity(input: SkuMetricsInput): SkuVelocityResult {
  const baseline = Math.max(1, input.salesVolumeBaseline24h);
  const growthRate = Math.max(-100, Math.round(((input.salesVolume24h - baseline) / baseline) * 100));

  const views = Math.max(1, input.viewCount24h ?? input.salesVolume24h * 30);
  const conversionRate = Number(((input.salesVolume24h / views) * 100).toFixed(2));

  // Multi-factor Velocity Formula:
  // Growth contribution (max 45 pts): 0.3 * normalized growth (cap at 150%)
  const growthScore = Math.min(45, Math.max(0, (growthRate / 150) * 45));

  // Commission attractiveness (max 30 pts): 0.3 * commissionRate * 100
  const commissionScore = Math.min(30, input.commissionRate * 100 * 0.75);

  // Conversion reliability (max 25 pts): 0.25 * (CR / 5%) * 25
  const crScore = Math.min(25, (conversionRate / 5) * 25);

  const rawScore = growthScore + commissionScore + crScore;
  const velocityScore = Number(Math.min(100, Math.max(0, rawScore)).toFixed(1));

  const hotTrendTier = classifyTier(velocityScore);
  const commissionPerOrder = Math.round(input.price * input.commissionRate);
  const commissionPct = Math.round(input.commissionRate * 100);

  const hooks = generateHookAngles(input.productName, hotTrendTier, commissionPct);

  return {
    skuCode: input.skuCode,
    velocityScore,
    hotTrendTier,
    growthRatePercentage: growthRate,
    conversionRatePercentage: conversionRate,
    estimatedCommissionPerOrder: commissionPerOrder,
    oneClickCampaignRecommendation: {
      recommendedHooks: hooks,
      urgencyText: `Đột phá ${growthRate}% lượng đơn trong 24h. Hoa hồng ${commissionPerOrder.toLocaleString('vi-VN')} ₫/đơn!`,
      targetAudience: 'Người tiêu dùng trẻ, thích săn deal & review công nghệ/gia dụng tiện ích',
    },
  };
}
