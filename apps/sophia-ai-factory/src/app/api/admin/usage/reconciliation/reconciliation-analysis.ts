import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';
import type {
  SupabaseUsageEvent,
  UsageEventWithStatus,
  BillingPeriod,
  LicenseInfo,
  ReconciliationResult,
  ReconciliationComparison,
  QuotaCompliance,
} from './reconciliation-types';
import {
  detectUsageSpikes,
  detectUsageGaps,
  detectDuplicateKeys,
} from './reconciliation-anomaly-detection';

/** Determine deduplication status of an event based on idempotency key and status code. */
export function determineDeduplicationStatus(
  event: SupabaseUsageEvent
): 'success' | 'duplicate' | 'failed' {
  if (event.idempotency_key) {
    if (event.status_code && event.status_code >= 400) return 'failed';
    return 'success';
  }
  return 'failed';
}

/** Build full raw payload object for an event. */
export function buildRawPayload(event: SupabaseUsageEvent): Record<string, unknown> {
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

/** Run full reconciliation analysis: comparison, anomalies, quota compliance. */
export function performReconciliationAnalysis(
  events: UsageEventWithStatus[],
  billingPeriods: BillingPeriod[],
  licenseInfo: LicenseInfo | null
): ReconciliationResult {
  const anomalies = [];
  const quotaCompliance: QuotaCompliance[] = [];

  const recordedCredits = events.reduce((sum, e) => sum + e.credits_used, 0);

  let billedCredits = 0;
  let comparison: ReconciliationComparison | null = null;

  if (billingPeriods.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    const matchedPeriod =
      billingPeriods.find(p => p.period_start <= now && p.period_end >= now) ||
      billingPeriods[0];
    billedCredits = matchedPeriod.quota_limit;
  }

  if (billedCredits > 0) {
    const discrepancy = recordedCredits - billedCredits;
    const discrepancyPercentage = billedCredits > 0 ? (discrepancy / billedCredits) * 100 : 0;

    comparison = {
      recorded_credits: recordedCredits,
      billed_credits: billedCredits,
      discrepancy: Math.abs(discrepancy),
      discrepancy_percentage: Math.round(discrepancyPercentage * 100) / 100,
      status: discrepancy > 0 ? 'over_billed' : discrepancy < 0 ? 'under_billed' : 'matched',
    };

    if (Math.abs(discrepancyPercentage) > 10) {
      anomalies.push({
        type: 'unusual_pattern' as const,
        severity: (Math.abs(discrepancyPercentage) > 50 ? 'high' : 'medium') as 'high' | 'medium',
        description: `Significant discrepancy detected: ${discrepancyPercentage.toFixed(1)}% difference between recorded (${recordedCredits}) and billed (${billedCredits}) credits`,
        affected_events: events.slice(0, 10).map(e => e.id),
        timestamp: Math.floor(Date.now() / 1000),
        recommended_action: 'Review usage events and billing period alignment. Verify quota limits match subscription tier.',
      });
    }
  }

  detectUsageSpikes(events, anomalies);
  detectUsageGaps(events, anomalies);
  detectDuplicateKeys(events, anomalies);

  if (licenseInfo?.tier) {
    const tier = licenseInfo.tier.toUpperCase() as keyof typeof QUOTA_LIMITS;
    const limits = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;
    const hourStart = Math.floor(Date.now() / 3600) * 3600;
    const dayStart = Math.floor(Date.now() / 86400) * 86400;

    const hourlyUsage = events
      .filter(e => e.created_at >= hourStart && e.created_at < hourStart + 3600)
      .reduce((sum, e) => sum + e.credits_used, 0);

    const dailyUsage = events
      .filter(e => e.created_at >= dayStart && e.created_at < dayStart + 86400)
      .reduce((sum, e) => sum + e.credits_used, 0);

    quotaCompliance.push({
      tier: licenseInfo.tier, period: 'hourly', limit: limits.hourlyCredits, consumed: hourlyUsage,
      compliance_percentage: Math.min(100, Math.round((hourlyUsage / limits.hourlyCredits) * 100)),
      exceeded: hourlyUsage > limits.hourlyCredits,
    });

    quotaCompliance.push({
      tier: licenseInfo.tier, period: 'daily', limit: limits.dailyCredits, consumed: dailyUsage,
      compliance_percentage: Math.min(100, Math.round((dailyUsage / limits.dailyCredits) * 100)),
      exceeded: dailyUsage > limits.dailyCredits,
    });

    if (hourlyUsage > limits.hourlyCredits || dailyUsage > limits.dailyCredits) {
      anomalies.push({
        type: 'quota_exceeded' as const,
        severity: 'high' as const,
        description: `Quota exceeded for tier ${licenseInfo.tier}: Hourly ${hourlyUsage}/${limits.hourlyCredits}, Daily ${dailyUsage}/${limits.dailyCredits}`,
        affected_events: events.slice(0, 5).map(e => e.id),
        timestamp: Math.floor(Date.now() / 1000),
        recommended_action: 'Review quota enforcement and consider tier upgrade or usage optimization.',
      });
    }
  }

  return { comparison, anomalies, quotaCompliance };
}

/** Build summary statistics across all events. */
export function buildReconciliationSummary(
  events: UsageEventWithStatus[],
  _licenseInfo: LicenseInfo | null
): {
  total_events: number;
  total_credits: number;
  total_tokens_input: number;
  total_tokens_output: number;
  success_count: number;
  error_count: number;
  duplicate_count: number;
  unique_services: string[];
  date_range: { earliest: number | null; latest: number | null };
} {
  const timestamps = events.map(e => e.created_at).filter(Boolean);

  return {
    total_events: events.length,
    total_credits: events.reduce((sum, e) => sum + e.credits_used, 0),
    total_tokens_input: events.reduce((sum, e) => sum + e.tokens_input, 0),
    total_tokens_output: events.reduce((sum, e) => sum + e.tokens_output, 0),
    success_count: events.filter(e => e.deduplication_status === 'success').length,
    error_count: events.filter(e => e.deduplication_status === 'failed').length,
    duplicate_count: events.filter(e => e.deduplication_status === 'duplicate').length,
    unique_services: [...new Set(events.map(e => e.service_name))],
    date_range: {
      earliest: timestamps.length > 0 ? Math.min(...timestamps) : null,
      latest: timestamps.length > 0 ? Math.max(...timestamps) : null,
    },
  };
}
