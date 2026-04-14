/**
 * Usage Reconciliation Admin Endpoint
 *
 * Provides comprehensive usage reconciliation for billing audit:
 * - Query raw usage events by license, customer, time range, service
 * - Display event payloads with idempotency and deduplication status
 * - Reconciliation analysis: recorded usage vs billing periods, quota limits, anomalies
 *
 * GET: Query with filters and reconciliation analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { D1Client } from '@/lib/db/d1-query-builder';
import { logger } from '@/lib/utils/logger-utility';
import { checkAdminAuth } from '../../licenses/middleware';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';

/**
 * Reconciliation request filters
 */
interface ReconciliationFilters {
  licenseNonce?: string;
  customerId?: string;
  service?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  limit: number;
  offset: number;
}

/**
 * Supabase usage event from database
 */
interface SupabaseUsageEvent {
  id: string;
  user_id: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: number;
  idempotency_key: string | null;
  external_customer_id: string | null;
  resource_type: string | null;
}

/**
 * License information for reconciliation
 */
interface LicenseInfo {
  nonce: string;
  tier: string;
  polar_customer_id: string | null;
  stripe_customer_id: string | null;
  polar_subscription_id: string | null;
  is_revoked: boolean;
  created_at: string;
  expires_at: number;
}

/**
 * Reconciliation result with analysis
 */
interface ReconciliationResult {
  comparison: ReconciliationComparison | null;
  anomalies: AnomalyDetected[];
  quotaCompliance: QuotaCompliance[];
}

/**
 * Query result with pagination
 */
interface UsageQueryResult {
  events: SupabaseUsageEvent[];
  totalCount: number;
}

/**
 * Usage event with deduplication status
 */
interface UsageEventWithStatus {
  id: string;
  user_id: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: number;
  idempotency_key: string | null;
  external_customer_id: string | null;
  resource_type: string | null;
  deduplication_status: 'success' | 'duplicate' | 'failed';
  raw_payload: Record<string, unknown>;
}

/**
 * Billing period from Polar/Stripe
 */
interface BillingPeriod {
  period_start: number;
  period_end: number;
  subscription_id?: string;
  tier: string;
  quota_limit: number;
}

/**
 * Reconciliation comparison result
 */
interface ReconciliationComparison {
  recorded_credits: number;
  billed_credits: number;
  discrepancy: number;
  discrepancy_percentage: number;
  status: 'matched' | 'over_billed' | 'under_billed';
}

/**
 * Anomaly detection result
 */
interface AnomalyDetected {
  type: 'spike' | 'gap' | 'quota_exceeded' | 'duplicate_detected' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affected_events: string[];
  timestamp: number;
  recommended_action: string;
}

/**
 * Quota compliance check
 */
interface QuotaCompliance {
  tier: string;
  period: 'hourly' | 'daily' | 'monthly';
  limit: number;
  consumed: number;
  compliance_percentage: number;
  exceeded: boolean;
}

/**
 * GET: Query usage events and perform reconciliation analysis
 *
 * Query params:
 * - license_nonce: Filter by license (optional)
 * - customer_id: Filter by Polar/Stripe customer ID (optional)
 * - service: Filter by service name (optional)
 * - start: Start timestamp (Unix seconds, optional)
 * - end: End timestamp (Unix seconds, optional)
 * - limit: Max events (default: 100, max: 1000)
 * - offset: Pagination offset (default: 0)
 * - include_raw: Include raw payloads (default: false)
 * - analyze: Perform reconciliation analysis (default: true)
 */
export async function GET(request: NextRequest) {
  // Check admin authorization
  const authError = checkAdminAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const filters: ReconciliationFilters = {
      licenseNonce: searchParams.get('license_nonce') || undefined,
      customerId: searchParams.get('customer_id') || undefined,
      service: searchParams.get('service') || undefined,
      startTimestamp: parseTimestamp(searchParams.get('start')),
      endTimestamp: parseTimestamp(searchParams.get('end')),
      limit: parseLimit(searchParams.get('limit')),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const includeRaw = searchParams.get('include_raw') === 'true';
    const performAnalysis = searchParams.get('analyze') !== 'false';

    logger.info('[Reconciliation] Querying usage events', {
      filters,
      includeRaw,
      performAnalysis,
    });

    const db = createServerClient();

    // Query usage events with filters
    const { events, totalCount } = await queryUsageEvents(db, filters);

    // Get license info for tier-based reconciliation
    const licenseInfo = filters.licenseNonce
      ? await getLicenseInfo(db, filters.licenseNonce)
      : null;

    // Get billing periods from payment events
    const billingPeriods = await queryBillingPeriods(
      db,
      filters.customerId || licenseInfo?.polar_customer_id || undefined,
      filters.startTimestamp,
      filters.endTimestamp
    );

    // Transform events with deduplication status
    const eventsWithStatus: UsageEventWithStatus[] = events.map(event => ({
      ...event,
      deduplication_status: determineDeduplicationStatus(event),
      raw_payload: includeRaw ? buildRawPayload(event) : {},
    }));

    // Perform reconciliation analysis
    let reconciliationAnalysis = null;
    let anomalies: AnomalyDetected[] = [];
    let quotaCompliance: QuotaCompliance[] = [];

    if (performAnalysis) {
      const analysis = performReconciliationAnalysis(
        eventsWithStatus,
        billingPeriods,
        licenseInfo
      );
      reconciliationAnalysis = analysis.comparison;
      anomalies = analysis.anomalies;
      quotaCompliance = analysis.quotaCompliance;
    }

    // Build summary statistics
    const summary = buildReconciliationSummary(eventsWithStatus, licenseInfo);

    return NextResponse.json({
      success: true,
      filters,
      events: eventsWithStatus,
      pagination: {
        total: totalCount,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: totalCount > filters.offset + filters.limit,
      },
      summary,
      reconciliation: reconciliationAnalysis,
      billing_periods: billingPeriods,
      anomalies,
      quota_compliance: quotaCompliance,
      license_info: licenseInfo,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Reconciliation] Critical error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform usage reconciliation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Parse timestamp from query param
 */
function parseTimestamp(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse limit with validation
 */
function parseLimit(value: string | null): number {
  const limit = parseInt(value || '100');
  return Math.max(1, Math.min(limit, 1000));
}

/**
 * Query usage events from database
 */
async function queryUsageEvents(
  supabase: D1Client,
  filters: ReconciliationFilters
): Promise<UsageQueryResult> {
  let query = supabase
    .from('usage_events')
    .select('*', { count: 'exact' });

  // Apply filters
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

  // Order by creation date descending (newest first)
  query = query.order('created_at', { ascending: false });

  // Apply pagination
  const rangeStart = filters.offset;
  const rangeEnd = filters.offset + filters.limit - 1;
  query = query.range(rangeStart, rangeEnd);

  const { data, error, count } = await query;

  if (error) {
    logger.error('[Reconciliation] Failed to query events', error);
    throw new Error(`Database query failed: ${error.message}`);
  }

  return {
    events: (data as SupabaseUsageEvent[]) || [],
    totalCount: count || 0,
  };
}

/**
 * Get license information for reconciliation
 */
async function getLicenseInfo(
  supabase: D1Client,
  nonce: string
): Promise<LicenseInfo | null> {
  const { data, error } = await supabase
    .from('raas_licenses')
    .select('nonce, tier, polar_customer_id, stripe_customer_id, polar_subscription_id, is_revoked, created_at, expires_at')
    .eq('nonce', nonce)
    .single();

  if (error || !data) {
    return null;
  }

  return data as LicenseInfo;
}

/**
 * Query billing periods from payment events
 */
async function queryBillingPeriods(
  supabase: D1Client,
  customerId: string | undefined,
  startTimestamp: number | undefined,
  endTimestamp: number | undefined
): Promise<BillingPeriod[]> {
  if (!customerId) {
    return [];
  }

  // Query payment events for subscription data
  let query = supabase
    .from('payment_events')
    .select('event_type, payload, created_at')
    .or(`event_type.eq.subscription.created,event_type.eq.subscription.updated,event_type.eq.checkout.updated`)
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    logger.error('[Reconciliation] Failed to query billing periods', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Extract billing periods from payment event payloads
  const periods: BillingPeriod[] = [];

  for (const event of data) {
    const payload = event.payload as Record<string, unknown>;

    // Extract period info from subscription events
    const periodStart = payload.current_period_start as string | undefined;
    const periodEnd = payload.current_period_end as string | undefined;
    const subscriptionId = payload.id as string | undefined;

    // Get tier from metadata
    const metadata = payload.metadata as Record<string, unknown> | undefined;
    const tier = (metadata?.tier as string) || 'PREMIUM';

    if (periodEnd) {
      const periodEndTs = Math.floor(new Date(periodEnd).getTime() / 1000);
      const periodStartTs = periodStart
        ? Math.floor(new Date(periodStart).getTime() / 1000)
        : periodEndTs - (30 * 86400); // Default 30 days

      // Filter by requested time range
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

  // Deduplicate by subscription ID and period
  const uniquePeriods = periods.filter(
    (period, index, self) =>
      index === self.findIndex(p => p.subscription_id === period.subscription_id)
  );

  return uniquePeriods.sort((a, b) => b.period_end - a.period_end);
}

/**
 * Determine deduplication status of an event
 */
function determineDeduplicationStatus(event: SupabaseUsageEvent): 'success' | 'duplicate' | 'failed' {
  // If idempotency key exists and event was inserted successfully
  if (event.idempotency_key) {
    // Check for error status
    if (event.status_code && event.status_code >= 400) {
      return 'failed';
    }
    return 'success';
  }

  // Events without idempotency key are legacy or failed dedup
  return 'failed';
}

/**
 * Build raw payload for event
 */
function buildRawPayload(event: SupabaseUsageEvent): Record<string, unknown> {
  return {
    id: event.id,
    user_id: event.user_id,
    license_nonce: event.license_nonce,
    service_name: event.service_name,
    endpoint: event.endpoint,
    action: event.action,
    credits_used: event.credits_used,
    tokens_input: event.tokens_input,
    tokens_output: event.tokens_output,
    status_code: event.status_code,
    error_message: event.error_message,
    response_time_ms: event.response_time_ms,
    created_at: event.created_at,
    idempotency_key: event.idempotency_key,
    external_customer_id: event.external_customer_id,
    resource_type: event.resource_type,
  };
}

/**
 * Perform reconciliation analysis
 */
function performReconciliationAnalysis(
  events: UsageEventWithStatus[],
  billingPeriods: BillingPeriod[],
  licenseInfo: LicenseInfo | null
): ReconciliationResult {
  const anomalies: AnomalyDetected[] = [];
  const quotaCompliance: QuotaCompliance[] = [];

  // Calculate total recorded credits
  const recordedCredits = events.reduce((sum, e) => sum + e.credits_used, 0);

  // Calculate billed credits from billing periods
  let billedCredits = 0;
  let matchedPeriod: BillingPeriod | null = null;

  if (billingPeriods.length > 0) {
    // Find the most relevant billing period
    const now = Math.floor(Date.now() / 1000);
    matchedPeriod = billingPeriods.find(
      p => p.period_start <= now && p.period_end >= now
    ) || billingPeriods[0];

    billedCredits = matchedPeriod.quota_limit;
  }

  // Build comparison
  let comparison: ReconciliationComparison | null = null;

  if (billedCredits > 0) {
    const discrepancy = recordedCredits - billedCredits;
    const discrepancyPercentage = billedCredits > 0
      ? (discrepancy / billedCredits) * 100
      : 0;

    comparison = {
      recorded_credits: recordedCredits,
      billed_credits: billedCredits,
      discrepancy: Math.abs(discrepancy),
      discrepancy_percentage: Math.round(discrepancyPercentage * 100) / 100,
      status: discrepancy > 0 ? 'over_billed' : discrepancy < 0 ? 'under_billed' : 'matched',
    };

    // Flag significant discrepancies as anomalies
    if (Math.abs(discrepancyPercentage) > 10) {
      anomalies.push({
        type: 'unusual_pattern',
        severity: Math.abs(discrepancyPercentage) > 50 ? 'high' : 'medium',
        description: `Significant discrepancy detected: ${discrepancyPercentage.toFixed(1)}% difference between recorded (${recordedCredits}) and billed (${billedCredits}) credits`,
        affected_events: events.slice(0, 10).map(e => e.id),
        timestamp: Math.floor(Date.now() / 1000),
        recommended_action: 'Review usage events and billing period alignment. Verify quota limits match subscription tier.',
      });
    }
  }

  // Check for usage spikes (sudden increases)
  detectUsageSpikes(events, anomalies);

  // Check for gaps in usage
  detectUsageGaps(events, anomalies);

  // Check for duplicate idempotency keys
  detectDuplicateKeys(events, anomalies);

  // Calculate quota compliance
  if (licenseInfo && licenseInfo.tier) {
    const tier = licenseInfo.tier.toUpperCase() as keyof typeof QUOTA_LIMITS;
    const limits = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;

    // Hourly compliance
    const hourStart = Math.floor(Date.now() / 3600) * 3600;
    const hourlyUsage = events
      .filter(e => e.created_at >= hourStart && e.created_at < hourStart + 3600)
      .reduce((sum, e) => sum + e.credits_used, 0);

    quotaCompliance.push({
      tier: licenseInfo.tier,
      period: 'hourly',
      limit: limits.hourlyCredits,
      consumed: hourlyUsage,
      compliance_percentage: Math.min(100, Math.round((hourlyUsage / limits.hourlyCredits) * 100)),
      exceeded: hourlyUsage > limits.hourlyCredits,
    });

    // Daily compliance
    const dayStart = Math.floor(Date.now() / 86400) * 86400;
    const dailyUsage = events
      .filter(e => e.created_at >= dayStart && e.created_at < dayStart + 86400)
      .reduce((sum, e) => sum + e.credits_used, 0);

    quotaCompliance.push({
      tier: licenseInfo.tier,
      period: 'daily',
      limit: limits.dailyCredits,
      consumed: dailyUsage,
      compliance_percentage: Math.min(100, Math.round((dailyUsage / limits.dailyCredits) * 100)),
      exceeded: dailyUsage > limits.dailyCredits,
    });

    // Flag quota exceeded
    if (hourlyUsage > limits.hourlyCredits || dailyUsage > limits.dailyCredits) {
      anomalies.push({
        type: 'quota_exceeded',
        severity: 'high',
        description: `Quota exceeded for tier ${licenseInfo.tier}: Hourly ${hourlyUsage}/${limits.hourlyCredits}, Daily ${dailyUsage}/${limits.dailyCredits}`,
        affected_events: events.slice(0, 5).map(e => e.id),
        timestamp: Math.floor(Date.now() / 1000),
        recommended_action: 'Review quota enforcement and consider tier upgrade or usage optimization.',
      });
    }
  }

  return { comparison, anomalies, quotaCompliance };
}

/**
 * Detect usage spikes
 */
function detectUsageSpikes(events: UsageEventWithStatus[], anomalies: AnomalyDetected[]) {
  if (events.length < 10) return;

  // Group events by hour
  const hourlyUsage = new Map<number, number>();
  for (const event of events) {
    const hourTs = Math.floor(event.created_at / 3600) * 3600;
    hourlyUsage.set(hourTs, (hourlyUsage.get(hourTs) || 0) + event.credits_used);
  }

  if (hourlyUsage.size < 3) return;

  const usageValues = Array.from(hourlyUsage.values());
  const avgUsage = usageValues.reduce((a, b) => a + b, 0) / usageValues.length;
  const maxUsage = Math.max(...usageValues);

  // Flag if max is > 3x average
  if (maxUsage > avgUsage * 3 && avgUsage > 0) {
    const spikeHour = Array.from(hourlyUsage.entries())
      .find(([_, v]) => v === maxUsage)?.[0] || 0;

    anomalies.push({
      type: 'spike',
      severity: maxUsage > avgUsage * 5 ? 'high' : 'medium',
      description: `Usage spike detected: ${maxUsage} credits in one hour (${Math.round(maxUsage / avgUsage)}x average)`,
      affected_events: events.filter(e => Math.floor(e.created_at / 3600) * 3600 === spikeHour).slice(0, 10).map(e => e.id),
      timestamp: spikeHour,
      recommended_action: 'Investigate cause of spike. Verify if legitimate usage or potential abuse.',
    });
  }
}

/**
 * Detect gaps in usage (periods with no events)
 */
function detectUsageGaps(events: UsageEventWithStatus[], anomalies: AnomalyDetected[]) {
  if (events.length < 2) return;

  const sortedEvents = [...events].sort((a, b) => a.created_at - b.created_at);
  const maxGapSeconds = 24 * 3600; // 24 hours

  for (let i = 1; i < sortedEvents.length; i++) {
    const gap = sortedEvents[i].created_at - sortedEvents[i - 1].created_at;

    if (gap > maxGapSeconds) {
      anomalies.push({
        type: 'gap',
        severity: gap > maxGapSeconds * 3 ? 'medium' : 'low',
        description: `Usage gap detected: No events for ${Math.round(gap / 3600)} hours`,
        affected_events: [sortedEvents[i - 1].id, sortedEvents[i].id],
        timestamp: sortedEvents[i - 1].created_at,
        recommended_action: gap > maxGapSeconds * 7
          ? 'Extended gap may indicate customer churn or integration issues. Consider outreach.'
          : 'Brief gap may be normal usage pattern. Monitor for trends.',
      });
    }
  }
}

/**
 * Detect duplicate idempotency keys
 */
function detectDuplicateKeys(events: UsageEventWithStatus[], anomalies: AnomalyDetected[]) {
  const keyCounts = new Map<string, string[]>();

  for (const event of events) {
    if (event.idempotency_key) {
      const existing = keyCounts.get(event.idempotency_key) || [];
      existing.push(event.id);
      keyCounts.set(event.idempotency_key, existing);
    }
  }

  for (const [key, eventIds] of keyCounts.entries()) {
    if (eventIds.length > 1) {
      anomalies.push({
        type: 'duplicate_detected',
        severity: 'high',
        description: `Duplicate idempotency key detected: ${key.slice(0, 16)}... appeared ${eventIds.length} times`,
        affected_events: eventIds.slice(0, 10),
        timestamp: Math.floor(Date.now() / 1000),
        recommended_action: 'Investigate duplicate submission source. Verify idempotency handling in client SDK.',
      });
    }
  }
}

/**
 * Build reconciliation summary
 */
function buildReconciliationSummary(
  events: UsageEventWithStatus[],
  licenseInfo: LicenseInfo | null
): {
  total_events: number;
  total_credits: number;
  total_tokens_input: number;
  total_tokens_output: number;
  success_count: number;
  error_count: number;
  duplicate_count: number;
  unique_services: string[];
  date_range: {
    earliest: number | null;
    latest: number | null;
  };
  tier_breakdown?: Record<string, number>;
} {
  const successCount = events.filter(e => e.deduplication_status === 'success').length;
  const errorCount = events.filter(e => e.deduplication_status === 'failed').length;
  const duplicateCount = events.filter(e => e.deduplication_status === 'duplicate').length;

  const uniqueServices = [...new Set(events.map(e => e.service_name))];

  const timestamps = events.map(e => e.created_at).filter(Boolean);
  const earliest = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const latest = timestamps.length > 0 ? Math.max(...timestamps) : null;

  return {
    total_events: events.length,
    total_credits: events.reduce((sum, e) => sum + e.credits_used, 0),
    total_tokens_input: events.reduce((sum, e) => sum + e.tokens_input, 0),
    total_tokens_output: events.reduce((sum, e) => sum + e.tokens_output, 0),
    success_count: successCount,
    error_count: errorCount,
    duplicate_count: duplicateCount,
    unique_services: uniqueServices,
    date_range: { earliest, latest },
  };
}
