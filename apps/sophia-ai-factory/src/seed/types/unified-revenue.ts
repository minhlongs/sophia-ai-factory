/**
 * Unified Revenue, Cohort Retention & Enterprise SLA Types
 *
 * Supports Milestone GATE 8: $1,000,000 MRR (5,000 Customers, $200 ARPU, Cohort NRR >= 130%, 99.999% SLA)
 *
 * Layer: seed/types (Foundational contracts - zero tree/forest/land dependencies)
 *
 * @module seed/types/unified-revenue
 */

export type RevenueChannel = 'direct_sales' | 'affiliate' | 'content_seo' | 'enterprise_deals';

export type SnapshotStatus = 'draft' | 'active' | 'archived' | 'reconciled';

export * from './unified-revenue-cohort';
export * from './unified-revenue-sla';

/**
 * Breakdown of MRR by channel.
 */
export interface ChannelRevenueBreakdown {
  channel: RevenueChannel;
  displayName: string;
  mrrCents: number;
  customerCount: number;
  percentageOfTotal: number;
  arpuCents: number;
}

/**
 * Single consolidated MRR snapshot persisted in D1.
 */
export interface UnifiedRevenueSnapshot {
  id: string;
  snapshotTimestamp: number;
  periodMonth: string; // 'YYYY-MM'
  directSalesCents: number;
  affiliateSalesCents: number;
  contentSeoCents: number;
  enterpriseDealsCents: number;
  totalMrrCents: number;
  activeCustomersCount: number;
  arpuCents: number;
  targetMrrCents: number; // 100,000,000 cents ($1,000,000 USD)
  targetCustomersCount: number; // 5,000
  targetArpuCents: number; // 20,000 cents ($200 USD)
  channelBreakdownJson: string;
  currency: string;
  status: SnapshotStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * Progress tracking towards the $1M MRR Gate 8 milestone.
 */
export interface MrrMilestoneProgress {
  currentMrrCents: number;
  targetMrrCents: number;
  mrrAttainmentPct: number; // (current / target) * 100
  currentCustomers: number;
  targetCustomers: number;
  customersAttainmentPct: number;
  currentArpuCents: number;
  targetArpuCents: number;
  isMilestoneAchieved: boolean;
  channels: ChannelRevenueBreakdown[];
}

/**
 * Input for consolidating 4-channel MRR numbers.
 */
export interface ConsolidateChannelsInput {
  periodMonth: string;
  directSalesCents: number;
  affiliateSalesCents: number;
  contentSeoCents: number;
  enterpriseDealsCents: number;
  activeCustomersCount: number;
  channelCustomerCounts?: Partial<Record<RevenueChannel, number>>;
  status?: SnapshotStatus;
  currency?: string;
}

/**
 * Standard action result shape for server actions.
 */
export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Milestone constants for Gate 8.
 */
export const GATE_8_CONSTANTS = {
  TARGET_MRR_CENTS: 100_000_000, // $1,000,000.00 USD
  TARGET_CUSTOMERS: 5_000,
  TARGET_ARPU_CENTS: 20_000, // $200.00 USD
  TARGET_NRR_PCT: 130.0, // 130.0%
  FIVE_NINES_SLA_PCT: 99.999, // 99.999%
  MONTHLY_PERIOD_SECONDS: 2_592_000, // 30 days * 86,400s
  FIVE_NINES_MONTHLY_ERROR_BUDGET_SECONDS: 25.92, // 25.92s allowed downtime
} as const;
