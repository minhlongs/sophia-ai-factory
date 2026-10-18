import {
  type ChannelRevenueBreakdown,
  type ConsolidateChannelsInput,
  type MrrMilestoneProgress,
  type RevenueChannel,
  GATE_8_CONSTANTS,
} from '@/seed/types/unified-revenue';
import { sanitizeCents } from './currency-normalizer';

/**
 * Consolidates revenue across all 4 monetization channels.
 * Guarantees zero-penny leakage invariance: totalMrrCents === sum(channels).
 */
export function consolidateMrrChannels(input: ConsolidateChannelsInput): {
  totalMrrCents: number;
  arpuCents: number;
  breakdowns: ChannelRevenueBreakdown[];
  progress: MrrMilestoneProgress;
  channelBreakdownJson: string;
} {
  const directSalesCents = sanitizeCents(input.directSalesCents);
  const affiliateSalesCents = sanitizeCents(input.affiliateSalesCents);
  const contentSeoCents = sanitizeCents(input.contentSeoCents);
  const enterpriseDealsCents = sanitizeCents(input.enterpriseDealsCents);
  const activeCustomersCount = Math.max(0, Math.round(input.activeCustomersCount));
  const totalMrrCents = directSalesCents + affiliateSalesCents + contentSeoCents + enterpriseDealsCents;
  const arpuCents = activeCustomersCount > 0 ? Math.floor(totalMrrCents / activeCustomersCount) : 0;

  const counts = input.channelCustomerCounts ?? {};
  const directCustomers = counts.direct_sales ?? Math.round(activeCustomersCount * 0.4);
  const enterpriseCustomers = counts.enterprise_deals ?? Math.round(activeCustomersCount * 0.1);
  const affiliateCustomers = counts.affiliate ?? Math.round(activeCustomersCount * 0.3);
  const contentCustomers = counts.content_seo ?? Math.max(0, activeCustomersCount - directCustomers - enterpriseCustomers - affiliateCustomers);

  const channelsData: Array<{ channel: RevenueChannel; displayName: string; mrrCents: number; customerCount: number }> = [
    { channel: 'direct_sales', displayName: 'Direct Sales & Self-Serve', mrrCents: directSalesCents, customerCount: directCustomers },
    { channel: 'enterprise_deals', displayName: 'Enterprise B2B Deals & GPU Lanes', mrrCents: enterpriseDealsCents, customerCount: enterpriseCustomers },
    { channel: 'affiliate', displayName: 'Creator Marketplace & Reseller Affiliates', mrrCents: affiliateSalesCents, customerCount: affiliateCustomers },
    { channel: 'content_seo', displayName: 'Organic Content SEO Funnel', mrrCents: contentSeoCents, customerCount: contentCustomers },
  ];

  const breakdowns: ChannelRevenueBreakdown[] = channelsData.map((c) => ({
    channel: c.channel,
    displayName: c.displayName,
    mrrCents: c.mrrCents,
    customerCount: c.customerCount,
    percentageOfTotal: totalMrrCents > 0 ? Number(((c.mrrCents / totalMrrCents) * 100).toFixed(2)) : 0,
    arpuCents: c.customerCount > 0 ? Math.floor(c.mrrCents / c.customerCount) : 0,
  }));

  const mrrAttainmentPct = Number(((totalMrrCents / GATE_8_CONSTANTS.TARGET_MRR_CENTS) * 100).toFixed(2));
  const customersAttainmentPct = Number(((activeCustomersCount / GATE_8_CONSTANTS.TARGET_CUSTOMERS) * 100).toFixed(2));

  const progress: MrrMilestoneProgress = {
    currentMrrCents: totalMrrCents,
    targetMrrCents: GATE_8_CONSTANTS.TARGET_MRR_CENTS,
    mrrAttainmentPct,
    currentCustomers: activeCustomersCount,
    targetCustomers: GATE_8_CONSTANTS.TARGET_CUSTOMERS,
    customersAttainmentPct,
    currentArpuCents: arpuCents,
    targetArpuCents: GATE_8_CONSTANTS.TARGET_ARPU_CENTS,
    isMilestoneAchieved: totalMrrCents >= GATE_8_CONSTANTS.TARGET_MRR_CENTS && activeCustomersCount >= GATE_8_CONSTANTS.TARGET_CUSTOMERS,
    channels: breakdowns,
  };

  return { totalMrrCents, arpuCents, breakdowns, progress, channelBreakdownJson: JSON.stringify(breakdowns) };
}

/**
 * Generates the authentic Gate 8 target financial model ($1,000,000 MRR, 5,000 customers, $200 ARPU).
 */
export function generateGate8TargetModel(): {
  input: ConsolidateChannelsInput;
  consolidated: ReturnType<typeof consolidateMrrChannels>;
} {
  const input: ConsolidateChannelsInput = {
    periodMonth: '2027-09',
    directSalesCents: 40_000_000,
    enterpriseDealsCents: 35_000_000,
    affiliateSalesCents: 15_000_000,
    contentSeoCents: 10_000_000,
    activeCustomersCount: 5_000,
    channelCustomerCounts: { direct_sales: 2_000, enterprise_deals: 500, affiliate: 1_500, content_seo: 1_000 },
    status: 'reconciled',
    currency: 'USD',
  };
  return { input, consolidated: consolidateMrrChannels(input) };
}
