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

export type SlaBreachLevel = 'none' | 'minor' | 'moderate' | 'critical';

export type SlaPenaltyStatus = 'none' | 'pending_approval' | 'credited' | 'refunded' | 'waived';

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
 * Single cell in the triangular cohort retention matrix.
 */
export interface CohortRetentionCell {
  id?: string;
  cohortMonth: string; // 'YYYY-MM'
  periodOffset: number; // Month 0 to 24
  startingCustomers: number;
  retainedCustomers: number;
  churnedCustomers: number;
  startingMrrCents: number;
  retainedBaseMrrCents: number;
  expansionMrrCents: number;
  contractionMrrCents: number;
  churnedMrrCents: number;
  endingMrrCents: number;
  grrPct: number; // Gross Revenue Retention %: <= 100.0%
  nrrPct: number; // Net Revenue Retention %: target >= 130.0%
  calculatedAt: number;
}

/**
 * Cohort row in the triangular matrix.
 */
export interface CohortRow {
  cohortMonth: string;
  startingCustomers: number;
  startingMrrCents: number;
  offsets: CohortRetentionCell[];
}

/**
 * Complete triangular cohort retention matrix.
 */
export interface CohortTriangularMatrix {
  cohorts: CohortRow[];
  aggregateAverageNrrPct: number;
  aggregateAverageGrrPct: number;
  targetNrrAchieved: boolean; // aggregateAverageNrrPct >= 130.0
}

/**
 * Input for computing a cohort cell.
 */
export interface CreateCohortCellInput {
  id?: string;
  cohortMonth: string;
  periodOffset: number;
  startingCustomers: number;
  startingMrrCents: number;
  retainedCustomers?: number;
  churnedCustomers?: number;
  expansionMrrCents?: number;
  contractionMrrCents?: number;
  churnedMrrCents?: number;
}

/**
 * Enterprise SLA evaluation and penalty credit ledger entry.
 */
export interface EnterpriseSlaEvaluation {
  id: string;
  tenantId: string;
  contractId: string;
  billingPeriod: string; // 'YYYY-MM'
  targetSlaPct: number; // 99.999
  actualUptimePct: number;
  totalPeriodSeconds: number; // 2,592,000 (30 days)
  downtimeSeconds: number;
  errorBudgetAllocatedSeconds: number; // 25.92
  errorBudgetConsumedSeconds: number;
  errorBudgetRemainingSeconds: number;
  breachLevel: SlaBreachLevel;
  penaltyCreditPct: number;
  penaltyCreditCents: number;
  penaltyStatus: SlaPenaltyStatus;
  incidentIds: string[];
  evaluatedAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for evaluating tenant SLA uptime.
 */
export interface EvaluateSlaInput {
  tenantId: string;
  contractId: string;
  billingPeriod: string;
  monthlyContractCents: number;
  downtimeSeconds: number;
  totalPeriodSeconds?: number;
  incidentIds?: string[];
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
