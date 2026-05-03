import { D1Client } from '@/seed/db/d1-query-builder';
import { QUOTA_LIMITS } from '@/forest/usage-metering/aggregator';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  ReconciliationFilters,
  SupabaseUsageEvent,
  LicenseInfo,
  BillingPeriod,
  UsageQueryResult,
} from './reconciliation-types';

/** Query usage events from database with filters and pagination. */
export async function queryUsageEvents(
  supabase: D1Client,
  filters: ReconciliationFilters
): Promise<UsageQueryResult> {
  let query = supabase
    .from('usage_events')
    .select('*', { count: 'exact' });

  if (filters.licenseNonce) {
    query = query.eq('license_nonce', filters.licenseNonce);
  }
  if (filters.customerId) {
    query = query.eq('external_customer_id', filters.customerId);
  }
  if (filters.service) {
    query = query.eq('service_name', filters.service);
  }
  if (filters.startTimestamp) {
    query = query.gte('created_at', filters.startTimestamp);
  }
  if (filters.endTimestamp) {
    query = query.lte('created_at', filters.endTimestamp);
  }

  query = query.order('created_at', { ascending: false });
  query = query.range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error('[Reconciliation] Failed to query events', toError(error));
    throw new Error(`Database query failed: ${error.message}`);
  }

  return {
    events: (data as unknown as SupabaseUsageEvent[]) || [],
    totalCount: count || 0,
  };
}

/** Get license information by nonce for tier-based reconciliation. */
export async function getLicenseInfo(
  supabase: D1Client,
  nonce: string
): Promise<LicenseInfo | null> {
  const { data, error } = await supabase
    .from('raas_licenses')
    .select('nonce, tier, polar_customer_id, stripe_customer_id, polar_subscription_id, is_revoked, created_at, expires_at')
    .eq('nonce', nonce)
    .single();

  if (error || !data) return null;
  return data as unknown as LicenseInfo;
}

/** Query billing periods from payment events for a customer. */
export async function queryBillingPeriods(
  supabase: D1Client,
  customerId: string | undefined,
  startTimestamp: number | undefined,
  endTimestamp: number | undefined
): Promise<BillingPeriod[]> {
  if (!customerId) return [];

  const query = supabase
    .from('payment_events')
    .select('event_type, payload, created_at')
    .or(`event_type.eq.subscription.created,event_type.eq.subscription.updated,event_type.eq.checkout.updated`)
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    logger.error('[Reconciliation] Failed to query billing periods', toError(error));
    return [];
  }

  if (!data || data.length === 0) return [];

  const periods: BillingPeriod[] = [];

  for (const event of data) {
    const payload = event.payload as Record<string, unknown>;
    const periodStart = payload.current_period_start as string | undefined;
    const periodEnd = payload.current_period_end as string | undefined;
    const subscriptionId = payload.id as string | undefined;
    const metadata = payload.metadata as Record<string, unknown> | undefined;
    const tier = (metadata?.tier as string) || 'PREMIUM';

    if (periodEnd) {
      const periodEndTs = Math.floor(new Date(periodEnd).getTime() / 1000);
      const periodStartTs = periodStart
        ? Math.floor(new Date(periodStart).getTime() / 1000)
        : periodEndTs - 30 * 86400;

      if (startTimestamp && periodEndTs < startTimestamp) continue;
      if (endTimestamp && periodStartTs > endTimestamp) continue;

      periods.push({
        period_start: periodStartTs,
        period_end: periodEndTs,
        subscription_id: subscriptionId,
        tier: tier.toUpperCase(),
        quota_limit: QUOTA_LIMITS[tier.toUpperCase()]?.monthlyCredits || 10000,
      });
    }
  }

  const unique = periods.filter(
    (p, i, arr) => i === arr.findIndex(x => x.subscription_id === p.subscription_id)
  );

  return unique.sort((a, b) => b.period_end - a.period_end);
}
