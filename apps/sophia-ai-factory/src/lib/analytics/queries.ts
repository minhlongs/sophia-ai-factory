/**
 * Analytics Query Helpers
 *
 * Supabase query functions for analytics dashboard
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type {
  UsageFilters,
  UsageMetrics,
  RevenuePeriod,
  RevenueMetrics,
  LicenseFilters,
  LicenseMetrics,
  LicenseUtilization,
  ViolationFilters,
  ViolationEvent,
  ViolationSummary,
} from './types';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';

/**
 * Maximum date range for queries (90 days)
 */
const MAX_DATE_RANGE_DAYS = 90;

/**
 * Fetch usage metrics from Supabase
 *
 * @param filters - Query filters for usage data
 */
export async function fetchUsageMetrics(filters: UsageFilters): Promise<UsageMetrics> {
  const supabase = await createAdminClient();

  // Validate date range
  const dateRangeDays = (filters.endTimestamp - filters.startTimestamp) / 86400;
  if (dateRangeDays > MAX_DATE_RANGE_DAYS) {
    throw new Error(`Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days`);
  }

  let query = supabase
    .from('usage_events')
    .select('*')
    .gte('created_at', filters.startTimestamp)
    .lte('created_at', filters.endTimestamp);

  if (filters.licenseNonce) {
    query = query.eq('license_nonce', filters.licenseNonce);
  }

  if (filters.service) {
    query = query.eq('service_name', filters.service);
  }

  const { data: events, error } = await query as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch usage events', error);
    throw new Error('Failed to fetch usage data');
  }

  if (!events || events.length === 0) {
    return {
      summary: {
        totalRequests: 0,
        totalTokensInput: 0,
        totalTokensOutput: 0,
        totalCredits: 0,
        avgResponseTimeMs: 0,
        errorRate: 0,
      },
      timeSeries: [],
      serviceBreakdown: [],
    };
  }

  // Build time-series data
  const granularity = filters.granularity || 'hour';
  const timeSeriesMap = new Map<number, {
    requests: number;
    credits: number;
    tokens: number;
    errors: number;
  }>();

  // Build service breakdown
  const serviceMap = new Map<string, {
    requests: number;
    credits: number;
  }>();

  // Calculate totals
  let totalRequests = 0;
  let totalCredits = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalErrors = 0;
  let totalResponseTime = 0;
  let responseTimeCount = 0;

  for (const event of events) {
    // Calculate time bucket
    const timestamp = granularity === 'hour'
      ? Math.floor(event.created_at / 3600) * 3600
      : Math.floor(event.created_at / 86400) * 86400;

    // Update time-series
    const tsEntry = timeSeriesMap.get(timestamp) || {
      requests: 0,
      credits: 0,
      tokens: 0,
      errors: 0,
    };
    tsEntry.requests += 1;
    tsEntry.credits += event.credits_used || 0;
    tsEntry.tokens += (event.tokens_input || 0) + (event.tokens_output || 0);
    if (!event.status_code || event.status_code >= 400) {
      tsEntry.errors += 1;
    }
    timeSeriesMap.set(timestamp, tsEntry);

    // Update service breakdown
    const serviceName = event.service_name || 'unknown';
    const serviceEntry = serviceMap.get(serviceName) || {
      requests: 0,
      credits: 0,
    };
    serviceEntry.requests += 1;
    serviceEntry.credits += event.credits_used || 0;
    serviceMap.set(serviceName, serviceEntry);

    // Update totals
    totalRequests += 1;
    totalCredits += event.credits_used || 0;
    totalTokensInput += event.tokens_input || 0;
    totalTokensOutput += event.tokens_output || 0;
    if (!event.status_code || event.status_code >= 400) {
      totalErrors += 1;
    }
    if (event.response_time_ms) {
      totalResponseTime += event.response_time_ms;
      responseTimeCount += 1;
    }
  }

  // Build time-series array
  const timeSeries = Array.from(timeSeriesMap.entries())
    .map(([timestamp, data]) => ({
      timestamp,
      requests: data.requests,
      credits: data.credits,
      tokens: data.tokens,
      errors: data.errors,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Build service breakdown with percentages
  const serviceBreakdown = Array.from(serviceMap.entries())
    .map(([service, data]) => ({
      service,
      requests: data.requests,
      credits: data.credits,
      percentage: totalRequests > 0 ? (data.requests / totalRequests) * 100 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  return {
    summary: {
      totalRequests,
      totalTokensInput,
      totalTokensOutput,
      totalCredits,
      avgResponseTimeMs: responseTimeCount > 0
        ? Math.round((totalResponseTime / responseTimeCount) * 100) / 100
        : 0,
      errorRate: totalRequests > 0
        ? Math.round((totalErrors / totalRequests) * 10000) / 100
        : 0,
    },
    timeSeries,
    serviceBreakdown,
  };
}

/**
 * Fetch revenue metrics from Supabase
 *
 * @param period - Revenue period filter
 */
export async function fetchRevenueMetrics(period: RevenuePeriod): Promise<RevenueMetrics> {
  const supabase = await createAdminClient();

  // Calculate date range based on period
  const now = new Date();
  let startTimestamp: number;
  let endTimestamp = Math.floor(now.getTime() / 1000);

  switch (period) {
    case 'current_month':
      startTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
      break;
    case 'last_month':
      startTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000);
      endTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth(), 0).getTime() / 1000);
      break;
    case 'last_7_days':
      startTimestamp = endTimestamp - (7 * 86400);
      break;
    case 'last_30_days':
      startTimestamp = endTimestamp - (30 * 86400);
      break;
    default:
      startTimestamp = endTimestamp - (30 * 86400);
  }

  // Query raas_licenses table
  const { data: licenses, error } = await supabase
    .from('raas_licenses')
    .select('tier, created_at, metadata')
    .gte('created_at', startTimestamp)
    .lte('created_at', endTimestamp) as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch licenses for revenue', error);
    throw new Error('Failed to fetch revenue data');
  }

  // Query payment_events for revenue trend
  const { data: paymentEvents } = await supabase
    .from('payment_events')
    .select('event_type, payload, created_at')
    .gte('created_at', new Date(startTimestamp * 1000).toISOString())
    .lte('created_at', new Date(endTimestamp * 1000).toISOString())
    .eq('processed', true) as any;

  // Calculate MRR from active licenses
  const mrrByTier = new Map<string, { customers: number; revenue: number }>();

  // Initialize tier buckets
  ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'].forEach(tier => {
    mrrByTier.set(tier, { customers: 0, revenue: 0 });
  });

  let totalRevenue = 0;
  let recurringRevenue = 0;
  let oneTimeRevenue = 0;

  // Process licenses for MRR calculation
  if (licenses && licenses.length > 0) {
    for (const license of licenses) {
      const tier = license.tier || 'BASIC';
      const entry = mrrByTier.get(tier) || { customers: 0, revenue: 0 };

      entry.customers += 1;

      // Extract MRR from metadata (Polar subscription data)
      const metadata = license.metadata as any;
      const mrr = metadata?.mrr_usd || metadata?.subscription_amount || 0;

      if (metadata?.is_subscription) {
        entry.revenue += mrr;
        recurringRevenue += mrr;
      } else {
        oneTimeRevenue += mrr;
      }

      totalRevenue += mrr;
      mrrByTier.set(tier, entry);
    }
  }

  // Process payment events for trend data
  const revenueByDate = new Map<string, number>();
  if (paymentEvents && paymentEvents.length > 0) {
    for (const event of paymentEvents) {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      const amount = (event.payload as any)?.amount?.usd?.amount || 0;

      const existing = revenueByDate.get(date) || 0;
      revenueByDate.set(date, existing + amount);
    }
  }

  // Build trend array
  const trend = Array.from(revenueByDate.entries())
    .map(([date, revenue]) => ({
      date,
      revenue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build byTier array
  const byTier = Array.from(mrrByTier.entries())
    .map(([tier, data]) => ({
      tier,
      customers: data.customers,
      revenue: data.revenue,
    }))
    .filter(t => t.customers > 0 || t.revenue > 0);

  return {
    totalRevenue,
    recurringRevenue,
    oneTimeRevenue,
    byTier,
    trend,
  };
}

/**
 * Fetch license metrics from Supabase
 *
 * @param filters - Query filters for license data
 */
export async function fetchLicenseMetrics(filters: LicenseFilters = {}): Promise<LicenseMetrics> {
  const supabase = await createAdminClient();
  const status = filters.status || 'active';

  let query = supabase.from('raas_licenses').select('*');

  // Apply status filter
  const now = Math.floor(Date.now() / 1000);
  if (status !== 'all') {
    switch (status) {
      case 'active':
        query = query.eq('is_revoked', false).or(`expires_at.is.null,expires_at.gt.${now}`);
        break;
      case 'expired':
        query = query.eq('is_revoked', false).lt('expires_at', now);
        break;
      case 'revoked':
        query = query.eq('is_revoked', true);
        break;
    }
  }

  // Apply tier filter
  if (filters.tier) {
    query = query.eq('tier', filters.tier);
  }

  const { data: licenses, error } = await query as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch licenses', error);
    throw new Error('Failed to fetch license data');
  }

  if (!licenses || licenses.length === 0) {
    return {
      total: 0,
      byTier: {},
      utilization: [],
    };
  }

  // Calculate byTier counts
  const byTier: Record<string, number> = {};
  for (const license of licenses) {
    const tier = license.tier || 'BASIC';
    byTier[tier] = (byTier[tier] || 0) + 1;
  }

  // Calculate utilization for each license
  const utilization: LicenseUtilization[] = [];

  for (const license of licenses) {
    const quota = QUOTA_LIMITS[license.tier] || QUOTA_LIMITS.BASIC;

    // Get usage for this license (current month)
    const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

    const { data: usageData } = await supabase
      .from('usage_events')
      .select('credits_used')
      .eq('license_nonce', license.nonce)
      .gte('created_at', monthStart);

    const usedCredits = usageData?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
    const limitCredit = quota.monthlyCredits;
    const percentage = limitCredit > 0 ? Math.round((usedCredits / limitCredit) * 10000) / 100 : 0;

    // Get overage events for this license (Phase 6)
    const { data: overageData } = await supabase
      .from('overage_events')
      .select('exceeded_by, billable')
      .eq('license_nonce', license.nonce)
      .gte('created_at', monthStart);

    const overageCount = overageData?.length || 0;
    const billableCount = overageData?.filter((e) => e.billable).length || 0;
    const overageCredits = overageData?.reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0;

    utilization.push({
      licenseNonce: license.nonce,
      tier: license.tier || 'BASIC',
      usedCredits,
      limitCredit,
      percentage: Math.min(percentage, 100),
      expiresAt: license.expires_at,
      overageCount,
      billableCount,
      overageCredits,
    });
  }

  return {
    total: licenses.length,
    byTier,
    utilization: utilization.sort((a, b) => b.percentage - a.percentage),
  };
}

/**
 * Fetch violation events from Supabase
 *
 * @param filters - Query filters for violation data
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 50, max: 100)
 */
export async function fetchViolations(
  filters: ViolationFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<{ violations: ViolationEvent[]; total: number; hasMore: boolean }> {
  const supabase = await createAdminClient();

  // Build query dynamically based on filters
  let query = supabase.from('violations').select('*', { count: 'exact' });

  if (filters.licenseNonce) {
    query = query.eq('license_nonce', filters.licenseNonce);
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }

  if (filters.startTimestamp) {
    query = query.gte('created_at', filters.startTimestamp);
  }

  if (filters.endTimestamp) {
    query = query.lte('created_at', filters.endTimestamp);
  }

  if (filters.resolved !== undefined) {
    query = query.eq('resolved', filters.resolved);
  }

  // Apply pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to).order('created_at', { ascending: false });

  const { data: violations, error, count } = await query as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch violations', error);
    throw new Error('Failed to fetch violations');
  }

  if (!violations || violations.length === 0) {
    return { violations: [], total: 0, hasMore: false };
  }

  // Transform database rows to ViolationEvent type
  interface ViolationRow {
    id: string;
    type: string;
    severity: string;
    user_id: string;
    license_nonce: string;
    tier: string;
    endpoint: string;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    resolved: boolean;
  }

  const typedViolations: ViolationEvent[] = violations.map((v: ViolationRow) => ({
    id: v.id,
    type: v.type,
    severity: v.severity,
    userId: v.user_id,
    licenseNonce: v.license_nonce,
    tier: v.tier,
    endpoint: v.endpoint,
    ipAddress: v.ip_address,
    userAgent: v.user_agent,
    metadata: v.metadata,
    createdAt: v.created_at,
    resolved: v.resolved,
    resolvedAt: v.resolved_at,
  }));

  const total = count || violations.length;
  const hasMore = from + violations.length < total;

  return {
    violations: typedViolations,
    total,
    hasMore,
  };
}

/**
 * Fetch violation summary statistics
 *
 * @param filters - Query filters for violation data
 * @param startTimestamp - Start timestamp for trend data
 * @param endTimestamp - End timestamp for trend data
 */
export async function fetchViolationSummary(
  filters: ViolationFilters = {},
  startTimestamp: number,
  endTimestamp: number
): Promise<ViolationSummary> {
  const supabase = await createAdminClient();

  // Build base query
  let query = supabase.from('violations').select('*');

  if (filters.licenseNonce) {
    query = query.eq('license_nonce', filters.licenseNonce);
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }

  if (filters.startTimestamp) {
    query = query.gte('created_at', filters.startTimestamp);
  }

  if (filters.endTimestamp) {
    query = query.lte('created_at', filters.endTimestamp);
  }

  if (filters.resolved !== undefined) {
    query = query.eq('resolved', filters.resolved);
  }

  const { data: violations, error } = await query as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch violation summary', error);
    throw new Error('Failed to fetch violation summary');
  }

  if (!violations || violations.length === 0) {
    return {
      totalViolations: 0,
      byType: {} as any,
      bySeverity: {} as any,
      byTier: {},
      resolvedCount: 0,
      unresolvedCount: 0,
      trend: [],
    };
  }

  // Calculate breakdowns
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  let resolvedCount = 0;

  for (const v of violations) {
    byType[v.type] = (byType[v.type] || 0) + 1;
    bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
    byTier[v.tier] = (byTier[v.tier] || 0) + 1;
    if (v.resolved) {
      resolvedCount += 1;
    }
  }

  // Calculate trend data (daily breakdown)
  const trendMap = new Map<string, number>();
  for (const v of violations) {
    const date = new Date(v.created_at * 1000).toISOString().split('T')[0];
    const count = trendMap.get(date) || 0;
    trendMap.set(date, count + 1);
  }

  const trend = Array.from(trendMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalViolations: violations.length,
    byType: byType as any,
    bySeverity: bySeverity as any,
    byTier,
    resolvedCount,
    unresolvedCount: violations.length - resolvedCount,
    trend,
  };
}
