/**
 * Customer Usage Accounting & Transparency Types.
 * Domain contracts for CEO billing transparency, quota tracking, and provider costs.
 *
 * @module land/billing/customer-usage-types
 */

import type { Tier } from '@/seed/types';

export interface DailyUsageBreakdown {
  date: string; // YYYY-MM-DD
  videoMinutes: number;
  elevenLabsChars: number;
  falAiImages: number;
  openRouterTokens: number;
  creditsUsed: number;
}

export interface ProviderUsageBreakdown {
  provider: string;
  metricName: string;
  totalUnits: number;
  creditsUsed: number;
  estimatedCostUsd: number;
  costClassification: 'METERED' | 'BYOK' | 'INCLUDED';
}

export interface CustomerUsagePlan {
  tier: Tier;
  name: string;
  price: number;
  billingType: 'monthly' | 'lifetime';
  status: string;
}

export interface CustomerUsageLimit {
  mcuMonthly: number;
  videoTemplates: number;
  campaignsPerMonth: number;
  youtubeChannels: number;
  aiCommands: number;
}

export interface CustomerUsageMetrics {
  mcuUsed: number;
  videoMinutes: number;
  elevenLabsChars: number;
  falAiImages: number;
  openRouterTokens: number;
  percentUsed: number;
}

export interface CustomerUsageRemaining {
  mcuRemaining: number;
}

export interface CustomerUsageOverage {
  overageCredits: number;
  pricePerCredit: number;
  estimatedOverageCost: number;
  isAccruing: boolean;
}

export interface NextBillingEvent {
  date: string | null;
  description: string;
  amount: number | null;
  isLifetime: boolean;
}

export interface CustomerUsageReport {
  userId: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  plan: CustomerUsagePlan;
  limit: CustomerUsageLimit;
  usage: CustomerUsageMetrics;
  remaining: CustomerUsageRemaining;
  overage: CustomerUsageOverage;
  nextBillingEvent: NextBillingEvent;
  totals: {
    videoMinutes: number;
    elevenLabsChars: number;
    falAiImages: number;
    openRouterTokens: number;
    totalCredits: number;
  };
  providers: ProviderUsageBreakdown[];
  dailyUsage: DailyUsageBreakdown[];
}
