/**
 * Usage Metering Aggregator
 *
 * Data aggregation and validation logic for usage metering
 * - Processes raw usage events from tracker.ts
 * - Enforces license-based quotas per tenant
 * - Exposes hourly/daily summaries
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type {
  AggregatedUsage,
  HourlySummary,
  DailySummary,
  QuotaLimit,
  QuotaCheckResult,
  CsvExportRow,
  BatchUsageRecord,
  IngestionResult,
  BatchIngestionResponse,
} from './types';

/**
 * Quota limits by tier
 */
export const QUOTA_LIMITS: Record<string, QuotaLimit> = {
  BASIC: {
    tier: 'BASIC',
    dailyCredits: 100,
    hourlyCredits: 20,
    dailyRequests: 500,
    monthlyCredits: 2000,
  },
  PREMIUM: {
    tier: 'PREMIUM',
    dailyCredits: 500,
    hourlyCredits: 100,
    dailyRequests: 2500,
    monthlyCredits: 10000,
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    dailyCredits: 2000,
    hourlyCredits: 500,
    dailyRequests: 10000,
    monthlyCredits: 50000,
  },
  MASTER: {
    tier: 'MASTER',
    dailyCredits: 10000,
    hourlyCredits: 2000,
    dailyRequests: 50000,
    monthlyCredits: 200000,
  },
};

/**
 * Aggregate raw usage events into time-windowed summaries
 *
 * @param events - Raw usage events from database
 * @param windowSize - 'hour' | 'day'
 */
export function aggregateUsageEvents(
  events: Array<{
    user_id: string;
    license_nonce: string;
    service_name: string;
    action: string;
    credits_used: number;
    tokens_input: number;
    tokens_output: number;
    response_time_ms: number | null;
    status_code: number | null;
    created_at: number;
  }>,
  windowSize: 'hour' | 'day' = 'hour'
): AggregatedUsage[] {
  const aggregationMap = new Map<string, AggregatedUsage>();

  for (const event of events) {
    // Calculate time window boundary
    const timestamp = windowSize === 'hour'
      ? Math.floor(event.created_at / 3600) * 3600  // Start of hour
      : Math.floor(event.created_at / 86400) * 86400;  // Start of day

    const featureKey = `${event.service_name}.${event.action}`;
    const key = `${event.user_id}:${event.license_nonce}:${featureKey}:${timestamp}`;

    const existing = aggregationMap.get(key) || {
      tenantId: event.user_id,
      licenseNonce: event.license_nonce,
      featureKey,
      timestamp,
      consumedUnits: 0,
      requestCount: 0,
      tokensInput: 0,
      tokensOutput: 0,
      avgResponseTimeMs: 0,
      errorCount: 0,
    };

    existing.consumedUnits += event.credits_used || 0;
    existing.requestCount += 1;
    existing.tokensInput += event.tokens_input || 0;
    existing.tokensOutput += event.tokens_output || 0;

    // Track errors (non-2xx status codes)
    if (!event.status_code || event.status_code >= 400) {
      existing.errorCount += 1;
    }

    // Running average for response time
    const totalRt = existing.avgResponseTimeMs * (existing.requestCount - 1) + (event.response_time_ms || 0);
    existing.avgResponseTimeMs = totalRt / existing.requestCount;

    aggregationMap.set(key, existing);
  }

  return Array.from(aggregationMap.values());
}

/**
 * Build hourly summary from aggregated events
 *
 * @param aggregatedEvents - Pre-aggregated usage events
 */
export function buildHourlySummary(aggregatedEvents: AggregatedUsage[]): HourlySummary[] {
  const hourlyMap = new Map<number, HourlySummary>();

  for (const event of aggregatedEvents) {
    const hourTs = event.timestamp;

    const existing = hourlyMap.get(hourTs) || {
      hourTimestamp: hourTs,
      serviceBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokens: 0,
    };

    // Add to service breakdown or merge with existing
    const existingService = existing.serviceBreakdown.find(
      s => s.featureKey === event.featureKey && s.licenseNonce === event.licenseNonce
    );

    if (existingService) {
      existingService.consumedUnits += event.consumedUnits;
      existingService.requestCount += event.requestCount;
      existingService.tokensInput += event.tokensInput;
      existingService.tokensOutput += event.tokensOutput;
    } else {
      existing.serviceBreakdown.push({ ...event });
    }

    existing.totalCredits += event.consumedUnits;
    existing.totalRequests += event.requestCount;
    existing.totalTokens += event.tokensInput + event.tokensOutput;

    hourlyMap.set(hourTs, existing);
  }

  return Array.from(hourlyMap.values()).sort((a, b) => a.hourTimestamp - b.hourTimestamp);
}

/**
 * Build daily summary from hourly summaries
 *
 * @param hourlySummaries - Hourly summary data
 */
export function buildDailySummary(hourlySummaries: HourlySummary[]): DailySummary[] {
  const dailyMap = new Map<number, DailySummary>();

  for (const hourly of hourlySummaries) {
    const dayTs = Math.floor(hourly.hourTimestamp / 86400) * 86400;

    const existing = dailyMap.get(dayTs) || {
      dayTimestamp: dayTs,
      hourlyBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
    };

    existing.hourlyBreakdown.push(hourly);
    existing.totalCredits += hourly.totalCredits;
    existing.totalRequests += hourly.totalRequests;

    // Calculate tokens from service breakdown
    for (const service of hourly.serviceBreakdown) {
      existing.totalTokensInput += service.tokensInput;
      existing.totalTokensOutput += service.tokensOutput;
    }

    dailyMap.set(dayTs, existing);
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.dayTimestamp - b.dayTimestamp);
}

/**
 * Maximum date range window for queries (90 days)
 * Prevents expensive full-table scans
 */
const MAX_DATE_RANGE_DAYS = 90;

/**
 * Check quota limits for a tenant
 *
 * @param tenantId - User ID
 * @param licenseNonce - License identifier
 * @param tier - User tier (BASIC, PREMIUM, ENTERPRISE, MASTER)
 * @param requestedCredits - Credits for the requested operation
 */
export async function checkQuota(
  tenantId: string,
  licenseNonce: string,
  tier: string,
  requestedCredits: number = 1
): Promise<QuotaCheckResult> {
  const quotaLimit = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;
  const supabase = createAdminClient();
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  try {
    // Get hourly usage - use type assertion for Supabase new table
    const { data: hourlyData } = await supabase
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', tenantId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', hourStart)
      .lt('created_at', hourStart + 3600) as any;

    // Get daily usage
    const { data: dailyData } = await supabase
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', tenantId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', dayStart)
      .lt('created_at', dayStart + 86400) as any;

    // Get monthly usage
    interface UsageDataRow {
      credits_used: number;
    }

    const { data: monthlyData } = await supabase
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', tenantId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', monthStart) as { data: UsageDataRow[] | null };

    const hourlyCredits = (hourlyData as UsageDataRow[])?.reduce((sum: number, r: UsageDataRow) => sum + (r.credits_used || 0), 0) || 0;
    const dailyCredits = (dailyData as UsageDataRow[])?.reduce((sum: number, r: UsageDataRow) => sum + (r.credits_used || 0), 0) || 0;
    const monthlyCredits = (monthlyData as UsageDataRow[])?.reduce((sum: number, r: UsageDataRow) => sum + (r.credits_used || 0), 0) || 0;
    const dailyRequests = dailyData?.length || 0;

    // Check limits
    if (hourlyCredits + requestedCredits > quotaLimit.hourlyCredits) {
      return {
        allowed: false,
        remaining: {
          dailyCredits: Math.max(0, quotaLimit.dailyCredits - dailyCredits),
          hourlyCredits: Math.max(0, quotaLimit.hourlyCredits - hourlyCredits),
          dailyRequests: Math.max(0, quotaLimit.dailyRequests - dailyRequests),
          monthlyCredits: Math.max(0, quotaLimit.monthlyCredits - monthlyCredits),
        },
        exceeded: {
          type: 'hourly_credits',
          limit: quotaLimit.hourlyCredits,
          current: hourlyCredits,
        },
      };
    }

    if (dailyCredits + requestedCredits > quotaLimit.dailyCredits) {
      return {
        allowed: false,
        remaining: {
          dailyCredits: Math.max(0, quotaLimit.dailyCredits - dailyCredits),
          hourlyCredits: Math.max(0, quotaLimit.hourlyCredits - hourlyCredits),
          dailyRequests: Math.max(0, quotaLimit.dailyRequests - dailyRequests),
          monthlyCredits: Math.max(0, quotaLimit.monthlyCredits - monthlyCredits),
        },
        exceeded: {
          type: 'daily_credits',
          limit: quotaLimit.dailyCredits,
          current: dailyCredits,
        },
      };
    }

    if (monthlyCredits + requestedCredits > quotaLimit.monthlyCredits) {
      return {
        allowed: false,
        remaining: {
          dailyCredits: Math.max(0, quotaLimit.dailyCredits - dailyCredits),
          hourlyCredits: Math.max(0, quotaLimit.hourlyCredits - hourlyCredits),
          dailyRequests: Math.max(0, quotaLimit.dailyRequests - dailyRequests),
          monthlyCredits: Math.max(0, quotaLimit.monthlyCredits - monthlyCredits),
        },
        exceeded: {
          type: 'monthly_credits',
          limit: quotaLimit.monthlyCredits,
          current: monthlyCredits,
        },
      };
    }

    if (dailyRequests + 1 > quotaLimit.dailyRequests) {
      return {
        allowed: false,
        remaining: {
          dailyCredits: Math.max(0, quotaLimit.dailyCredits - dailyCredits),
          hourlyCredits: Math.max(0, quotaLimit.hourlyCredits - hourlyCredits),
          dailyRequests: Math.max(0, quotaLimit.dailyRequests - dailyRequests),
          monthlyCredits: Math.max(0, quotaLimit.monthlyCredits - monthlyCredits),
        },
        exceeded: {
          type: 'daily_requests',
          limit: quotaLimit.dailyRequests,
          current: dailyRequests,
        },
      };
    }

    // All checks passed
    return {
      allowed: true,
      remaining: {
        dailyCredits: quotaLimit.dailyCredits - dailyCredits,
        hourlyCredits: quotaLimit.hourlyCredits - hourlyCredits,
        dailyRequests: quotaLimit.dailyRequests - dailyRequests,
        monthlyCredits: quotaLimit.monthlyCredits - monthlyCredits,
      },
    };
  } catch (error) {
    logger.error('[Quota Check] Error checking quota', error instanceof Error ? error : new Error(String(error)));
    // Fail open - allow request if quota check fails
    return {
      allowed: true,
      remaining: {
        dailyCredits: 0,
        hourlyCredits: 0,
        dailyRequests: 0,
        monthlyCredits: 0,
      },
    };
  }
}

/**
 * Generate CSV export rows with standardized field names
 *
 * @param events - Raw usage events (can include external_customer_id)
 */
export function generateCsvRows(events: Array<{
  user_id: string;
  license_nonce: string;
  service_name: string;
  action: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  status_code: number | null;
  response_time_ms: number | null;
  created_at: number;
  external_customer_id?: string | null;
}>): CsvExportRow[] {
  return events.map(event => ({
    tenant_id: event.user_id,
    feature_key: `${event.service_name}.${event.action}`,
    timestamp: event.created_at,
    consumed_units: event.credits_used,
    request_count: 1,
    tokens_input: event.tokens_input,
    tokens_output: event.tokens_output,
    license_nonce: event.license_nonce,
    service: event.service_name,
    action: event.action,
    status: (!event.status_code || event.status_code >= 400) ? 'error' : 'success',
    response_time_ms: event.response_time_ms,
    external_customer_id: event.external_customer_id || null,
  }));
}

/**
 * Escape CSV field to prevent CSV injection attacks
 * Special characters at start of field can trigger formula execution
 *
 * @param value - Value to escape
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  // Characters that can trigger formula injection
  const dangerousPrefixes = ['=', '+', '-', '@'];

  if (dangerousPrefixes.some(prefix => str.startsWith(prefix))) {
    // Escape by prefixing with single quote and wrapping in quotes
    return `'${str}'`;
  }

  // Escape quotes and wrap in quotes if contains comma/newline
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert CSV rows to CSV string
 *
 * @param rows - CSV export rows
 */
export function rowsToCsv(rows: CsvExportRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = [
    'tenant_id',
    'feature_key',
    'timestamp',
    'consumed_units',
    'request_count',
    'tokens_input',
    'tokens_output',
    'license_nonce',
    'service',
    'action',
    'status',
    'response_time_ms',
  ];

  const csvRows = rows.map(row => [
    escapeCsvField(row.tenant_id),
    escapeCsvField(row.feature_key),
    escapeCsvField(row.timestamp),
    escapeCsvField(row.consumed_units),
    escapeCsvField(row.request_count),
    escapeCsvField(row.tokens_input),
    escapeCsvField(row.tokens_output),
    escapeCsvField(row.license_nonce),
    escapeCsvField(row.service),
    escapeCsvField(row.action),
    escapeCsvField(row.status),
    escapeCsvField(row.response_time_ms),
  ].join(','));

  return [headers.join(','), ...csvRows].join('\n');
}

/**
 * Get aggregated summary for a tenant by period
 *
 * @param tenantId - User ID
 * @param licenseNonce - Optional license filter
 * @param startTimestamp - Start of period
 * @param endTimestamp - End of period
 */
export async function getAggregatedSummary(
  tenantId: string,
  startTimestamp: number,
  endTimestamp: number,
  licenseNonce?: string
): Promise<{
  hourly: HourlySummary[];
  daily: DailySummary[];
  totalCredits: number;
  totalRequests: number;
}> {
  // Validate date range (max 90 days)
  const maxRange = MAX_DATE_RANGE_DAYS * 86400;
  if (endTimestamp - startTimestamp > maxRange) {
    logger.warn('[Aggregator] Date range exceeds maximum, limiting to 90 days');
    endTimestamp = startTimestamp + maxRange;
  }

  const supabase = createAdminClient();

  let query = supabase
    .from('usage_events')
    .select('*')
    .eq('user_id', tenantId)
    .gte('created_at', startTimestamp)
    .lte('created_at', endTimestamp);

  if (licenseNonce) {
    query = query.eq('license_nonce', licenseNonce);
  }

  const { data: events, error } = await query as any;

  if (error) {
    logger.error('[Aggregator] Failed to fetch events for aggregation', error);
    return {
      hourly: [],
      daily: [],
      totalCredits: 0,
      totalRequests: 0,
    };
  }

  if (!events || events.length === 0) {
    return {
      hourly: [],
      daily: [],
      totalCredits: 0,
      totalRequests: 0,
    };
  }

  // Aggregate and build summaries
  const aggregated = aggregateUsageEvents(events as any, 'hour');
  const hourly = buildHourlySummary(aggregated);
  const daily = buildDailySummary(hourly);

  const totalCredits = hourly.reduce((sum, h) => sum + h.totalCredits, 0);
  const totalRequests = hourly.reduce((sum, h) => sum + h.totalRequests, 0);

  return {
    hourly,
    daily,
    totalCredits,
    totalRequests,
  };
}

/**
 * Validate a single batch usage record
 */
function validateBatchRecord(record: BatchUsageRecord): { valid: boolean; error?: string } {
  // Required fields
  if (!record.tenant_id || !record.license_nonce || !record.service || !record.action) {
    return { valid: false, error: 'Missing required fields: tenant_id, license_nonce, service, action' };
  }

  // Validate service name
  const validServices = ['heygen', 'elevenlabs', 'openrouter'];
  if (!validServices.includes(record.service)) {
    return { valid: false, error: `Invalid service: ${record.service}. Must be one of: ${validServices.join(', ')}` };
  }

  // Validate timestamp (not in future, not older than 30 days)
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 86400);
  if (record.timestamp > now) {
    return { valid: false, error: 'Timestamp cannot be in the future' };
  }
  if (record.timestamp < thirtyDaysAgo) {
    return { valid: false, error: 'Timestamp cannot be older than 30 days' };
  }

  // Validate numeric fields
  if (record.consumed_units < 0 || record.request_count < 1) {
    return { valid: false, error: 'consumed_units must be >= 0, request_count must be >= 1' };
  }

  // Validate feature_key format
  if (!record.feature_key.includes('.')) {
    return { valid: false, error: 'feature_key must be in format: service.action (e.g., heygen.createVideo)' };
  }

  return { valid: true };
}

/**
 * Batch ingest usage records with validation and quota enforcement
 *
 * @param records - Array of usage records to ingest
 * @param userId - User ID for validation (must match tenant_id owner)
 */
export async function batchIngestUsage(
  records: BatchUsageRecord[],
  userId: string
): Promise<BatchIngestionResponse> {
  const supabase = createAdminClient();
  const results: IngestionResult[] = [];
  const acceptedRecords: Record<string, unknown>[] = [];

  // Track quota usage per license during batch processing
  const quotaCache = new Map<string, QuotaCheckResult>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const result: IngestionResult = { index: i, success: false };

    try {
      // Step 1: Validate record format
      const validation = validateBatchRecord(record);
      if (!validation.valid) {
        result.error = validation.error;
        result.reason = 'validation_error';
        results.push(result);
        continue;
      }

      // Step 2: Verify license exists and is active
      const { data: license, error: licenseError } = await supabase
        .from('raas_licenses')
        .select('nonce, tier, is_revoked, created_by')
        .eq('nonce', record.license_nonce)
        .single() as any;

      if (licenseError || !license) {
        result.error = 'License not found';
        result.reason = 'invalid_license';
        results.push(result);
        continue;
      }

      if (license.is_revoked) {
        result.error = 'License has been revoked';
        result.reason = 'invalid_license';
        results.push(result);
        continue;
      }

      // Step 3: Get user tier for quota checking
      const tier = license.tier || 'BASIC';

      // Step 4: Check quota (use cache for same license in batch)
      const cacheKey = `${record.license_nonce}:${tier}`;
      let quotaResult = quotaCache.get(cacheKey);

      if (!quotaResult) {
        quotaResult = await checkQuota(
          record.tenant_id,
          record.license_nonce,
          tier,
          record.consumed_units
        );
        quotaCache.set(cacheKey, quotaResult);
      }

      if (!quotaResult.allowed) {
        result.error = `Quota exceeded: ${quotaResult.exceeded?.type}`;
        result.reason = 'quota_exceeded';
        result.quotaRemaining = quotaResult.remaining;
        results.push(result);
        continue;
      }

      // Step 5: Prepare record for insertion
      acceptedRecords.push({
        user_id: record.tenant_id,
        license_key_hash: record.tenant_id,
        license_nonce: record.license_nonce,
        service_name: record.service,
        endpoint: `/${record.service}/${record.action}`,
        action: record.action,
        tokens_input: record.tokens_input || 0,
        tokens_output: record.tokens_output || 0,
        credits_used: record.consumed_units,
        status_code: record.status === 'success' ? 200 : 400,
        error_message: record.status === 'error' ? 'Client-reported error' : null,
        response_time_ms: record.response_time_ms ?? null,
        created_at: record.timestamp,
      } as any);

      result.success = true;
      result.quotaRemaining = quotaResult.remaining;
      results.push(result);

      // Update cache for next record with same license
      quotaCache.set(cacheKey, quotaResult);
    } catch (error) {
      logger.error('[Batch Ingest] Error processing record', error instanceof Error ? error : new Error(String(error)));
      result.error = 'Internal error during processing';
      results.push(result);
    }
  }

  // Step 6: Insert all accepted records in a single batch
  if (acceptedRecords.length > 0) {
    const { error: insertError } = await (supabase as any)
      .from('usage_events')
      .insert(acceptedRecords);

    if (insertError) {
      logger.error('[Batch Ingest] Failed to insert records', insertError);
      // Mark all accepted records as failed
      for (const r of results) {
        if (r.success) {
          r.success = false;
          r.error = 'Database insertion failed';
        }
      }
    }
  }

  const accepted = results.filter(r => r.success).length;
  const rejected = results.filter(r => !r.success).length;

  return {
    total: records.length,
    accepted,
    rejected,
    results,
    timestamp: new Date().toISOString(),
  };
}
