---
title: "Phase 03: Export Service - Business Logic for Querying and Formatting"
description: Core export service with database queries, CSV/JSON formatting, and Polar billing period support
status: pending
priority: P1
effort: 2h
branch: main
tags: [service, database, csv, json, billing]
created: 2026-03-08
---

# Phase 03: Export Service - Business Logic for Querying and Formatting

## Overview

Implement the core export service that queries usage data from the database, formats it for billing reconciliation, and supports Polar.sh billing period mapping.

## Success Criteria

- [ ] `exportUsageData()` function queries usage_events efficiently
- [ ] Support for filtering by license, customer, service, date range
- [ ] CSV formatting with standardized column names
- [ ] JSON formatting with nested aggregated data
- [ ] Polar billing period to timestamp conversion
- [ ] Idempotency key tracking for export deduplication

## Files to Create

1. `src/lib/usage-metering/export-service.ts` - Core export business logic
2. `src/lib/audit/export-audit-logger.ts` - Export-specific audit logging
3. `src/lib/usage-metering/polar-billing-periods.ts` - Polar billing period helpers

## Files to Modify

1. `src/lib/usage-metering/export.ts` - Add new export functions

## Implementation Steps

### Step 1: Create Export Service (`src/lib/usage-metering/export-service.ts`)

```typescript
/**
 * Usage Export Service
 *
 * Core business logic for exporting usage data for billing reconciliation
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { ExportRow, AggregatedExportRow, ExportFilters, PolarBillingPeriod } from './export-types';
import type { Json } from '@/lib/supabase/types';

/**
 * Export query result
 */
export interface ExportDataResult {
  exportId: string;
  rows: ExportRow[];
  aggregated?: {
    hourly: AggregatedExportRow[];
    daily: AggregatedExportRow[];
  };
  summary: {
    totalCredits: number;
    totalRequests: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    uniqueCustomers: number;
    uniqueLicenses: number;
  };
  rowCount: number;
}

/**
 * Export query options
 */
export interface ExportQueryOptions {
  userId?: string;
  licenseNonce?: string;
  customerId?: string;
  service?: string;
  startTimestamp: number;
  endTimestamp: number;
  includeRawPayload?: boolean;
  includeAggregated?: boolean;
}

/**
 * Export usage data for billing reconciliation
 *
 * Query flow:
 * 1. Build filters from options
 * 2. Query usage_events table
 * 3. Transform to standardized export rows
 * 4. Optionally include aggregated summaries
 * 5. Calculate summary statistics
 *
 * @param options - Export query options
 * @returns Export data result
 */
export async function exportUsageData(options: ExportQueryOptions): Promise<ExportDataResult> {
  const exportId = crypto.randomUUID();
  const supabase = createAdminClient();

  logger.info('[Export Service] Starting export', {
    exportId,
    filters: {
      userId: options.userId ? '***' : undefined,
      licenseNonce: options.licenseNonce?.slice(0, 8),
      customerId: options.customerId,
      dateRange: `${options.startTimestamp} - ${options.endTimestamp}`,
    },
  });

  // Step 1: Query raw events
  const rawEvents = await queryUsageEvents(supabase, {
    userId: options.userId,
    licenseNonce: options.licenseNonce,
    customerId: options.customerId,
    service: options.service,
    startTimestamp: options.startTimestamp,
    endTimestamp: options.endTimestamp,
    limit: 100000,  // Safety limit
    offset: 0,
  });

  logger.info('[Export Service] Queried events', {
    exportId,
    count: rawEvents.length,
  });

  // Step 2: Transform to standardized export rows
  const rows = transformToExportRows(rawEvents);

  // Step 3: Get aggregated data if requested
  let aggregated: ExportDataResult['aggregated'];
  if (options.includeAggregated) {
    aggregated = {
      hourly: await queryAggregatedData(supabase, options, 'hourly'),
      daily: await queryAggregatedData(supabase, options, 'daily'),
    };
  }

  // Step 4: Calculate summary statistics
  const summary = calculateSummary(rows);

  return {
    exportId,
    rows,
    aggregated,
    summary,
    rowCount: rows.length,
  };
}

/**
 * Query usage events from database
 */
async function queryUsageEvents(
  supabase: ReturnType<typeof createAdminClient>,
  filters: ExportFilters
): Promise<Array<{
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
}>> {
  let query = supabase
    .from('usage_events')
    .select('*')
    .order('created_at', { ascending: true });

  // Apply filters
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
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

  // Pagination
  query = query.range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error } = await query as any;

  if (error) {
    logger.error('[Export Service] Query failed', error);
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Transform raw events to standardized export rows
 */
function transformToExportRows(
  events: Array<{
    user_id: string;
    license_nonce: string;
    service_name: string;
    endpoint: string;
    action: string;
    credits_used: number;
    tokens_input: number;
    tokens_output: number;
    status_code: number | null;
    created_at: number;
    idempotency_key: string | null;
    external_customer_id: string | null;
    response_time_ms: number | null;
  }>
): ExportRow[] {
  return events.map(event => ({
    tenant_id: event.user_id,
    feature_key: `${event.service_name}.${event.action}`,
    quantity: event.credits_used,
    timestamp: event.created_at,
    license_nonce: event.license_nonce,
    external_customer_id: event.external_customer_id,
    service: event.service_name,
    action: event.action,
    endpoint: event.endpoint,
    tokens_input: event.tokens_input,
    tokens_output: event.tokens_output,
    status: event.status_code && event.status_code >= 400 ? 'error' : 'success',
    response_time_ms: event.response_time_ms,
    idempotency_key: event.idempotency_key,
  }));
}

/**
 * Query aggregated data (hourly/daily summaries)
 */
async function queryAggregatedData(
  supabase: ReturnType<typeof createAdminClient>,
  options: ExportQueryOptions,
  windowType: 'hourly' | 'daily'
): Promise<AggregatedExportRow[]> {
  const tableName = windowType === 'hourly' ? 'usage_hourly_summary' : 'usage_daily_summary';
  const timestampColumn = windowType === 'hourly' ? 'hour_timestamp' : 'day_timestamp';

  let query = supabase
    .from(tableName)
    .select('*')
    .order(timestampColumn, { ascending: true });

  if (options.userId) {
    query = query.eq('tenant_id', options.userId);
  }
  if (options.licenseNonce) {
    query = query.eq('license_nonce', options.licenseNonce);
  }
  if (options.startTimestamp) {
    query = query.gte(timestampColumn, options.startTimestamp);
  }
  if (options.endTimestamp) {
    query = query.lte(timestampColumn, options.endTimestamp);
  }

  const { data, error } = await query as any;

  if (error) {
    logger.error('[Export Service] Aggregated query failed', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    tenant_id: row.tenant_id,
    license_nonce: row.license_nonce,
    external_customer_id: row.external_customer_id,
    window_type: windowType,
    window_start: row[timestampColumn],
    window_end: windowType === 'hourly'
      ? row[timestampColumn] + 3600
      : row[timestampColumn] + 86400,
    total_quantity: row.total_credits,
    total_requests: row.total_requests,
    total_tokens_input: row.total_tokens_input,
    total_tokens_output: row.total_tokens_output,
    avg_response_time_ms: row.avg_response_time_ms,
    error_count: row.total_errors,
    service_breakdown: row.service_breakdown as Json,
  }));
}

/**
 * Calculate summary statistics from export rows
 */
function calculateSummary(rows: ExportRow[]): {
  totalCredits: number;
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  uniqueCustomers: number;
  uniqueLicenses: number;
} {
  const uniqueCustomers = new Set(rows.map(r => r.external_customer_id).filter(Boolean));
  const uniqueLicenses = new Set(rows.map(r => r.license_nonce));

  return {
    totalCredits: rows.reduce((sum, r) => sum + r.quantity, 0),
    totalRequests: rows.length,
    totalTokensInput: rows.reduce((sum, r) => sum + (r.tokens_input || 0), 0),
    totalTokensOutput: rows.reduce((sum, r) => sum + (r.tokens_output || 0), 0),
    uniqueCustomers: uniqueCustomers.size,
    uniqueLicenses: uniqueLicenses.size,
  };
}
```

### Step 2: Create Export Audit Logger (`src/lib/audit/export-audit-logger.ts`)

```typescript
/**
 * Export Audit Logger
 *
 * Logs all export requests for compliance and billing audit
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { ExportAuditLog } from '@/lib/usage-metering/export-types';

/**
 * Export audit log parameters
 */
export interface ExportAuditParams {
  exportId: string;
  userId: string;
  licenseNonce?: string;
  format: 'json' | 'csv';
  rowCount: number;
  dateRange: {
    start: number;
    end: number;
  };
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log export request for audit trail
 *
 * @param params - Export audit parameters
 */
export async function logExportAudit(params: ExportAuditParams): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const createdAt = Math.floor(Date.now() / 1000);

    const auditLog: ExportAuditLog = {
      id: crypto.randomUUID(),
      userId: params.userId,
      licenseNonce: params.licenseNonce,
      format: params.format,
      rowCount: params.rowCount,
      dateRange: params.dateRange,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      createdAt,
      exportId: params.exportId,
    };

    const { data, error } = await (supabase as any)
      .from('export_audit_logs')
      .insert({
        id: auditLog.id,
        user_id: params.userId,
        license_nonce: params.licenseNonce,
        format: params.format,
        row_count: params.rowCount,
        date_range_start: params.dateRange.start,
        date_range_end: params.dateRange.end,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        created_at: createdAt,
        export_id: params.exportId,
      } as any)
      .select('id')
      .single() as any;

    if (error) throw error;

    logger.info('[Export Audit] Export logged', {
      exportId: params.exportId,
      userId: params.userId,
      format: params.format,
      rowCount: params.rowCount,
    });

    return data?.id || null;
  } catch (error) {
    logger.error('[Export Audit] Failed to log export', error as Error);
    return null;
  }
}
```

### Step 3: Create Polar Billing Period Helpers (`src/lib/usage-metering/polar-billing-periods.ts`)

```typescript
/**
 * Polar Billing Period Helpers
 *
 * Utilities for mapping Polar.sh billing periods to export date ranges
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { PolarBillingPeriod } from './export-types';

/**
 * Get billing periods for a customer from payment_events
 *
 * @param customerId - Polar customer ID
 * @param limit - Max periods to return
 */
export async function getPolarBillingPeriods(
  customerId: string,
  limit: number = 12
): Promise<PolarBillingPeriod[]> {
  try {
    const supabase = createAdminClient();

    // Query payment events for subscription data
    const { data: events, error } = await supabase
      .from('payment_events')
      .select('event_type, payload, created_at')
      .or('event_type.eq.subscription.created,event_type.eq.subscription.updated,event_type.eq.checkout.created')
      .order('created_at', { ascending: false })
      .limit(limit * 2) as any;  // Fetch extra to filter

    if (error) throw error;

    const periods: PolarBillingPeriod[] = [];

    for (const event of events || []) {
      const payload = event.payload as Record<string, unknown>;
      const customer = (payload.customer_id as string) ||
                       ((payload.customer as Record<string, unknown>)?.id as string);

      if (customer !== customerId) continue;

      // Extract period info
      const currentPeriodEnd = payload.current_period_end as string | undefined;
      const currentPeriodStart = payload.current_period_start as string | undefined;
      const subscriptionId = payload.id as string | undefined;
      const metadata = payload.metadata as Record<string, unknown> | undefined;

      if (!currentPeriodEnd) continue;

      const periodEnd = Math.floor(new Date(currentPeriodEnd).getTime() / 1000);
      const periodStart = currentPeriodStart
        ? Math.floor(new Date(currentPeriodStart).getTime() / 1000)
        : periodEnd - (30 * 86400);

      // Determine period type
      const periodType: 'weekly' | 'monthly' =
        (periodEnd - periodStart) <= (10 * 86400) ? 'weekly' : 'monthly';

      const tier = ((metadata?.tier as string) || 'PREMIUM').toUpperCase();

      // Get quota limit from tier
      const quotaLimit = getTierQuotaLimit(tier);

      periods.push({
        periodId: `period_${periodStart}_${periodEnd}`,
        subscriptionId: subscriptionId || 'unknown',
        customerId,
        periodType,
        periodStart,
        periodEnd,
        tier,
        quotaLimit,
      });

      if (periods.length >= limit) break;
    }

    return periods;
  } catch (error) {
    logger.error('[Polar Billing] Failed to get billing periods', error as Error);
    return [];
  }
}

/**
 * Get current active billing period
 */
export async function getCurrentBillingPeriod(
  customerId: string
): Promise<PolarBillingPeriod | null> {
  const periods = await getPolarBillingPeriods(customerId, 1);
  const now = Math.floor(Date.now() / 1000);

  return periods.find(p => p.periodStart <= now && p.periodEnd >= now) || null;
}

/**
 * Get quota limit for tier
 */
function getTierQuotaLimit(tier: string): number {
  const limits: Record<string, number> = {
    BASIC: 1000,
    PREMIUM: 10000,
    ENTERPRISE: 100000,
    MASTER: 1000000,
  };
  return limits[tier] || 10000;
}

/**
 * Convert billing period to timestamp range
 */
export function billingPeriodToTimestamps(
  period: PolarBillingPeriod
): { start: number; end: number } {
  return {
    start: period.periodStart,
    end: period.periodEnd,
  };
}
```

## Todo Checklist

- [ ] Create `src/lib/usage-metering/export-service.ts`
- [ ] Create `src/lib/audit/export-audit-logger.ts`
- [ ] Create `src/lib/usage-metering/polar-billing-periods.ts`
- [ ] Update `src/lib/usage-metering/export.ts`
- [ ] Test database queries
- [ ] Test CSV formatting
- [ ] Test JSON formatting
- [ ] Test Polar billing period mapping

## Related Code Files

- `src/lib/usage-metering/rollup-service.ts` - Aggregation pattern reference
- `src/lib/usage-metering/export.ts` - Existing export utilities
- `src/app/api/webhooks/polar/route.ts` - Polar webhook payload structure

## Dependencies

- `usage_events` table
- `usage_hourly_summary` table
- `usage_daily_summary` table
- `payment_events` table (for Polar billing periods)

## Unresolved Questions

1. Should we cache export results for repeated requests with same parameters?
2. Should export include overage_events data for billing reconciliation?
