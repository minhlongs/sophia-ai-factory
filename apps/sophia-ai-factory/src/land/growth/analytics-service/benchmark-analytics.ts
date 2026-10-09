/**
 * Benchmark Analytics Baseline Telemetry
 *
 * Layer: Land (Domain service & data aggregation, imports seed only)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module land/growth/analytics-service/benchmark-analytics
 */

import type { GrowthAnalyticsSummary } from '@/seed/types/solutions-types';
import { calculateFunnelStages } from './funnel-calculator';
import { calculateMrrProgress } from './mrr-calculator';

/**
 * Baseline telemetry used when D1 tables are initializing or in cold-start.
 */
export const BENCHMARK_ANALYTICS: GrowthAnalyticsSummary = {
  fromTimestamp: Date.now() - 30 * 86400000,
  toTimestamp: Date.now(),
  totalVisitors: 14820,
  totalLeads: 540,
  totalTrials: 168,
  totalPaid: 4,
  overallConversionRatePct: 0.03, // (4 / 14820) * 100
  funnelStages: calculateFunnelStages({
    visitors: 14820,
    leads: 540,
    trials: 168,
    paid: 4,
  }),
  mrrProgress: calculateMrrProgress({
    tierCounts: { basic: 2, premium: 1, enterprise: 1, master: 0 },
  }),
  channelAttribution: [
    {
      channel: 'viral_videos',
      channelLabelEn: 'Viral Videos (TikTok, Shorts, X)',
      channelLabelVi: 'Video Viral (TikTok, Shorts, X)',
      visitors: 8650,
      leads: 312,
      trials: 98,
      paid: 2,
      conversionRatePct: 0.64,
      mrrContributionUsd: 598,
    },
    {
      channel: 'telegram_bot',
      channelLabelEn: 'Telegram Bot Automated Sales',
      channelLabelVi: 'Bot Telegram Tư Vấn & Chốt Sales',
      visitors: 2840,
      leads: 135,
      trials: 42,
      paid: 1,
      conversionRatePct: 0.74,
      mrrContributionUsd: 199,
    },
    {
      channel: 'programmatic_seo',
      channelLabelEn: 'Programmatic SEO Solutions',
      channelLabelVi: 'Trang Giải Pháp SEO Theo Ngành',
      visitors: 2210,
      leads: 68,
      trials: 21,
      paid: 1,
      conversionRatePct: 1.47,
      mrrContributionUsd: 799,
    },
    {
      channel: 'affiliate_partners',
      channelLabelEn: 'Affiliate Partner Program',
      channelLabelVi: 'Đối Tác Tiếp Thị Liên Kết',
      visitors: 1120,
      leads: 25,
      trials: 7,
      paid: 0,
      conversionRatePct: 0.0,
      mrrContributionUsd: 0,
    },
  ],
  recentLeads: [
    {
      id: 'lead_tg_0921',
      source: 'telegram_bot',
      nameOrChat: '@alex_realtor (Alex Pham)',
      niche: 'real-estate',
      score: 85,
      status: 'checkout_opened',
      createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    },
    {
      id: 'lead_seo_0920',
      source: 'seo_landing',
      nameOrChat: 'contact@auraderma.vn',
      niche: 'cosmetics',
      score: 90,
      status: 'qualified',
      createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    },
    {
      id: 'lead_vid_0919',
      source: 'viral_video',
      nameOrChat: '@solopreneur_vibes',
      niche: 'solopreneur',
      score: 75,
      status: 'demo_sent',
      createdAt: new Date(Date.now() - 180 * 60000).toISOString(),
    },
    {
      id: 'lead_aff_0918',
      source: 'affiliate',
      nameOrChat: 'partner_lead_884',
      niche: 'e-commerce',
      score: 95,
      status: 'converted',
      createdAt: new Date(Date.now() - 360 * 60000).toISOString(),
    },
  ],
};
