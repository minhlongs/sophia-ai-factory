/**
 * Real-Time Growth Analytics Domain Types
 *
 * Types for executive admin growth analytics ($5K MRR milestone & 4-stage funnel).
 *
 * Layer: Seed (Foundational types, no upper layer imports)
 *
 * @module seed/types/solutions-growth-analytics-types
 */

export type FunnelStageKey = 'visitors' | 'leads' | 'trials' | 'paid';

export interface FunnelStageMetrics {
  stage: FunnelStageKey;
  labelEn: string;
  labelVi: string;
  count: number;
  previousCount: number;
  conversionRateFromPrev: number; // 0.0 - 100.0%
  dropoffRateFromPrev: number;    // 0.0 - 100.0%
}

export interface MrrTierBreakdown {
  basic: { count: number; mrr: number };
  premium: { count: number; mrr: number };
  enterprise: { count: number; mrr: number };
  master: { count: number; revenue: number };
}

export interface MrrMilestoneProgress {
  targetMrrUsd: number;               // Canonical: 5000
  currentMrrUsd: number;
  progressPct: number;                 // (current / target) * 100
  gapToTargetUsd: number;              // Math.max(0, 5000 - current)
  targetPayingCustomers: number;       // Canonical: 10
  currentPayingCustomers: number;
  customerProgressPct: number;         // (current / target) * 100
  customerGap: number;                 // Math.max(0, 10 - current)
  arpu: number;                        // Average Revenue Per User
  runwayVelocityPct: number;           // Growth pace or monthly progress
  tierBreakdown: MrrTierBreakdown;
}

export type ChannelAttributionKey =
  | 'viral_videos'
  | 'telegram_bot'
  | 'programmatic_seo'
  | 'affiliate_partners'
  | 'direct';

export interface ChannelAttributionItem {
  channel: ChannelAttributionKey;
  channelLabelEn: string;
  channelLabelVi: string;
  visitors: number;
  leads: number;
  trials: number;
  paid: number;
  conversionRatePct: number;
  mrrContributionUsd: number;
}

export interface RecentGrowthLeadItem {
  id: string;
  source: string;
  nameOrChat: string;
  niche: string;
  score: number;
  status: 'new' | 'qualified' | 'demo_sent' | 'checkout_opened' | 'converted' | 'lost';
  createdAt: string;
}

export interface GrowthAnalyticsSummary {
  fromTimestamp: number;
  toTimestamp: number;
  funnelStages: FunnelStageMetrics[];
  mrrProgress: MrrMilestoneProgress;
  channelAttribution: ChannelAttributionItem[];
  recentLeads: RecentGrowthLeadItem[];
  totalVisitors: number;
  totalLeads: number;
  totalTrials: number;
  totalPaid: number;
  overallConversionRatePct: number;
}
