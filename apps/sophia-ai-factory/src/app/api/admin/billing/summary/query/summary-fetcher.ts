import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  BillingSummary,
  BillingSummaryQueryResult,
  DunningRow,
  MRRCustomerRecord,
  OverageRow,
} from './types';
import { calculateMRR } from './mrr-calculator';
import { aggregateDunningStates, calculateUnbilledOverageCents } from './overage-calculator';

export async function fetchBillingSummaryData(): Promise<BillingSummaryQueryResult> {
  const db = createServerClient();

  const [
    subscriptionsResult,
    mrrResult,
    dunningStatesResult,
    unbilledOverageResult,
    activeLicensesResult,
    issuesResult,
  ] = await Promise.all([
    db.from('subscriptions').select('plan, status').eq('status', 'active'),
    db
      .from('dunning_settings')
      .select('stripe_customer_id, dunning_state')
      .eq('dunning_state', 'current'),
    db.from('dunning_settings').select('dunning_state').order('dunning_state'),
    db.from('overage_events').select('exceeded_by, tier_at_exceeded').eq('billable', false),
    db.from('raas_api_keys').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db
      .from('dunning_settings')
      .select('id', { count: 'exact', head: true })
      .in('dunning_state', ['past_due', 'delinquent', 'suspended']),
  ]);

  if (subscriptionsResult.error) logger.warn('[Billing Summary] Warning fetching active subscriptions');
  if (dunningStatesResult.error) logger.error('[Billing Summary] Error fetching dunning states');
  if (unbilledOverageResult.error) logger.error('[Billing Summary] Error fetching unbilled overage');
  if (activeLicensesResult.error) logger.error('[Billing Summary] Error fetching active licenses');

  const activeSubs = (subscriptionsResult.data as unknown as MRRCustomerRecord[]) || [];
  const mrrData =
    activeSubs.length > 0
      ? activeSubs
      : ((mrrResult.data as unknown as MRRCustomerRecord[]) || []);

  return {
    mrrData,
    dunningRows: (dunningStatesResult.data as unknown as DunningRow[]) || [],
    overageRows: (unbilledOverageResult.data as unknown as OverageRow[]) || [],
    activeLicensesCount: activeLicensesResult.count || 0,
    licensesWithIssues: issuesResult.count || 0,
  };
}

/**
 * Build the full BillingSummary from raw DB results.
 */
export function buildBillingSummary(result: BillingSummaryQueryResult): BillingSummary {
  const mrr = calculateMRR(result.mrrData);
  return {
    mrr: mrr.totalCents,
    currency: 'USD',
    dunningStates: aggregateDunningStates(result.dunningRows),
    unbilledOverageTotal: calculateUnbilledOverageCents(result.overageRows),
    activeLicensesCount: result.activeLicensesCount,
    licensesWithIssues: result.licensesWithIssues,
    generatedAt: new Date().toISOString(),
  };
}
