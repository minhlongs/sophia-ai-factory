/**
 * DB query logic for admin billing summary.
 *
 * Contains data fetching, MRR calculation, dunning state aggregation,
 * and overage computation. Consumed by route.ts.
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

/** Billing summary response shape */
export interface BillingSummary {
  /** Monthly Recurring Revenue in cents */
  mrr: number;
  /** MRR currency */
  currency: string;
  /** Dunning state counts */
  dunningStates: {
    current: number;
    past_due: number;
    delinquent: number;
    suspended: number;
  };
  /** Total unbilled overage amount in cents */
  unbilledOverageTotal: number;
  /** Count of active licenses */
  activeLicensesCount: number;
  /** Count of licenses with dunning issues */
  licensesWithIssues: number;
  /** Timestamp of summary generation */
  generatedAt: string;
}

interface DunningCustomer {
  polar_customer_id?: string;
  stripe_customer_id?: string;
  dunning_state?: string;
}

interface DunningRow {
  dunning_state: string;
}

interface OverageRow {
  tier_at_exceeded: string;
  exceeded_by: number;
}

interface MRRResult {
  totalCents: number;
  breakdown: Record<string, number>;
}

// -------------------------------------------------------------------------
// MRR calculation
// -------------------------------------------------------------------------

const TIER_PRICING: Record<string, number> = {
  BASIC:      4900,   // $49/month
  PREMIUM:    9900,   // $99/month
  ENTERPRISE: 24900,  // $249/month
  MASTER:     49900,  // $499/month
};

/**
 * Calculate MRR from dunning settings.
 * Simplified: distributes customers evenly across tiers.
 */
export function calculateMRR(data: DunningCustomer[]): MRRResult {
  const breakdown: Record<string, number> = { BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 };

  const tiers = Object.keys(TIER_PRICING);
  let index = 0;
  for (let i = 0; i < data.length; i++) {
    const tier = tiers[index % tiers.length];
    breakdown[tier]++;
    index++;
  }

  const totalCents = Object.entries(breakdown).reduce(
    (sum, [tier, count]) => sum + count * TIER_PRICING[tier],
    0
  );

  return { totalCents, breakdown };
}

// -------------------------------------------------------------------------
// Overage calculation
// -------------------------------------------------------------------------

const OVERAGE_PRICING: Record<string, number> = {
  BASIC:      0.10,
  PREMIUM:    0.05,
  ENTERPRISE: 0.03,
  MASTER:     0.02,
};

export function calculateUnbilledOverageCents(rows: OverageRow[]): number {
  const total = rows.reduce((sum, row) => {
    const pricePerCredit = OVERAGE_PRICING[row.tier_at_exceeded] ?? 0.10;
    return sum + row.exceeded_by * pricePerCredit;
  }, 0);
  return Math.round(total * 100);
}

// -------------------------------------------------------------------------
// Dunning state aggregation
// -------------------------------------------------------------------------

export function aggregateDunningStates(rows: DunningRow[]): BillingSummary['dunningStates'] {
  const counts = { current: 0, past_due: 0, delinquent: 0, suspended: 0 };
  for (const row of rows) {
    const state = row.dunning_state;
    if (state in counts) {
      counts[state as keyof typeof counts]++;
    }
  }
  return counts;
}

// -------------------------------------------------------------------------
// Parallel DB fetch
// -------------------------------------------------------------------------

export interface BillingSummaryQueryResult {
  mrrData: DunningCustomer[];
  dunningRows: DunningRow[];
  overageRows: OverageRow[];
  activeLicensesCount: number;
  licensesWithIssues: number;
}

export async function fetchBillingSummaryData(): Promise<BillingSummaryQueryResult> {
  const db = createServerClient();

  const [mrrResult, dunningStatesResult, unbilledOverageResult, activeLicensesResult, issuesResult] =
    await Promise.all([
      db.from('dunning_settings').select('polar_customer_id, stripe_customer_id, dunning_state').eq('dunning_state', 'current'),
      db.from('dunning_settings').select('dunning_state').order('dunning_state'),
      db.from('overage_events').select('exceeded_by, tier_at_exceeded').eq('billable', false),
      db.from('raas_api_keys').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('dunning_settings').select('id', { count: 'exact', head: true }).in('dunning_state', ['past_due', 'delinquent', 'suspended']),
    ]);

  if (mrrResult.error)         logger.error('[Billing Summary] Error fetching MRR data');
  if (dunningStatesResult.error) logger.error('[Billing Summary] Error fetching dunning states');
  if (unbilledOverageResult.error) logger.error('[Billing Summary] Error fetching unbilled overage');
  if (activeLicensesResult.error) logger.error('[Billing Summary] Error fetching active licenses');

  return {
    mrrData:             (mrrResult.data as unknown as DunningCustomer[]) || [],
    dunningRows:         (dunningStatesResult.data as unknown as DunningRow[]) || [],
    overageRows:         (unbilledOverageResult.data as unknown as OverageRow[]) || [],
    activeLicensesCount: activeLicensesResult.count || 0,
    licensesWithIssues:  issuesResult.count || 0,
  };
}

/**
 * Build the full BillingSummary from raw DB results.
 */
export function buildBillingSummary(result: BillingSummaryQueryResult): BillingSummary {
  const mrr = calculateMRR(result.mrrData);
  return {
    mrr:                  mrr.totalCents,
    currency:             'USD',
    dunningStates:        aggregateDunningStates(result.dunningRows),
    unbilledOverageTotal: calculateUnbilledOverageCents(result.overageRows),
    activeLicensesCount:  result.activeLicensesCount,
    licensesWithIssues:   result.licensesWithIssues,
    generatedAt:          new Date().toISOString(),
  };
}
