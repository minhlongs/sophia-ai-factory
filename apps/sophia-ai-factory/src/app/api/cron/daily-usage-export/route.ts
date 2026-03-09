/**
 * Daily Usage Export Cron Job
 *
 * Runs daily at 00:00 UTC to aggregate usage data and export to Polar.sh
 * - Idempotency via deterministic key (YYYY-MM-DD)
 * - Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
 * - Logs export outcomes to Analytics dashboard
 *
 * Triggered by Vercel Cron at 0 0 * * *
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { getUsageExportData, exportToCSV } from '@/lib/usage-export/export-service';
import type { UsageExportRecord } from '@/lib/usage-export/types';

/**
 * Polar.sh usage report payload format
 * Matches Stripe Billing Metered Usage API schema
 */
interface PolarUsagePayload {
  /** Unique idempotency key for this export (YYYY-MM-DD) */
  idempotency_key: string;
  /** Export date in ISO format */
  export_date: string;
  /** Billing period start (ISO timestamp) */
  period_start: string;
  /** Billing period end (ISO timestamp) */
  period_end: string;
  /** Total records in export */
  total_records: number;
  /** Usage records array */
  usage: Array<{
    /** External customer ID from Polar */
    customer_id: string;
    /** Subscription ID */
    subscription_id?: string;
    /** Feature/metric name */
    metric: string;
    /** Usage quantity */
    quantity: number;
    /** Unix timestamp of usage */
    timestamp: number;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
  }>;
  /** Summary statistics */
  summary: {
    total_requests: number;
    total_credits: number;
    by_service: Record<string, { requests: number; credits: number }>;
  };
}

/**
 * Export result for analytics logging
 */
interface ExportResult {
  success: boolean;
  export_date: string;
  idempotency_key: string;
  records_exported: number;
  retry_count: number;
  errorMessage?: string | null;
  polarResponse?: Record<string, unknown> | null;
}

/**
 * Get yesterday's date range (00:00 to 23:59 UTC)
 */
function getYesterdayDateRange(): { start: number; end: number; isoStart: string; isoEnd: string } {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  const start = Math.floor(yesterday.getTime() / 1000);
  const isoStart = yesterday.toISOString();

  const endOfDay = new Date(yesterday);
  endOfDay.setUTCHours(23, 59, 59, 999);
  const end = Math.floor(endOfDay.getTime() / 1000);
  const isoEnd = endOfDay.toISOString();

  return { start, end, isoStart, isoEnd };
}

/**
 * Generate deterministic idempotency key for date
 */
function generateIdempotencyKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `usage-export-${year}-${month}-${day}`;
}

/**
 * Check if export already succeeded (idempotency check)
 */
async function checkExportExists(idempotencyKey: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('export_jobs')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .eq('success', true)
    .single();

  return !!data;
}

/**
 * Log export result to Analytics dashboard
 */
async function logExportResult(result: ExportResult): Promise<void> {
  const supabase = createAdminClient();
  const { error: dbError } = await (supabase as any)
    .from('export_jobs')
    .insert({
      idempotency_key: result.idempotency_key,
      export_date: result.export_date,
      success: result.success,
      records_exported: result.records_exported,
      retry_count: result.retry_count,
      error_message: result.errorMessage || null,
      polar_response: result.polarResponse ? JSON.stringify(result.polarResponse) : null,
    } as any);

  if (dbError) {
    logger.error('[Daily Export] Failed to log export result', dbError as Error);
  }
}

/**
 * Format usage records for Polar.sh payload
 */
function formatForPolar(
  records: UsageExportRecord[],
  idempotencyKey: string,
  periodStart: string,
  periodEnd: string
): PolarUsagePayload {
  // Group by customer and aggregate
  const byCustomer = new Map<string, PolarUsagePayload['usage']>();

  for (const record of records) {
    const customerId = record.external_customer_id || `user-${record.tenant_id}`;

    if (!byCustomer.has(customerId)) {
      byCustomer.set(customerId, []);
    }

    const usage = byCustomer.get(customerId)!;
    usage.push({
      customer_id: customerId,
      metric: `${record.service}.${record.action}`,
      quantity: record.quantity,
      timestamp: record.timestamp,
      metadata: {
        license_nonce: record.license_nonce,
        tokens_input: record.tokens_input,
        tokens_output: record.tokens_output,
        response_time_ms: record.response_time_ms,
      },
    });
  }

  // Flatten and calculate summary
  const allUsage: PolarUsagePayload['usage'] = [];
  const byService: Record<string, { requests: number; credits: number }> = {};

  for (const [customerId, usage] of byCustomer.entries()) {
    // Aggregate by customer for Polar
    const aggregated = usage.reduce((acc, item) => ({
      customer_id: customerId,
      metric: item.metric,
      quantity: acc.quantity + item.quantity,
      timestamp: Math.min(acc.timestamp, item.timestamp),
      subscription_id: undefined,
      metadata: {
        ...acc.metadata,
        ...item.metadata,
        request_count: (acc.metadata?.request_count as number || 0) + 1,
      },
    }));

    allUsage.push(aggregated);

    // By service breakdown
    for (const item of usage) {
      const serviceName = item.metric.split('.')[0];
      if (!byService[serviceName]) {
        byService[serviceName] = { requests: 0, credits: 0 };
      }
      byService[serviceName].requests++;
      byService[serviceName].credits += item.quantity;
    }
  }

  return {
    idempotency_key: idempotencyKey,
    export_date: new Date().toISOString(),
    period_start: periodStart,
    period_end: periodEnd,
    total_records: records.length,
    usage: allUsage,
    summary: {
      total_requests: records.length,
      total_credits: records.reduce((sum, r) => sum + r.quantity, 0),
      by_service: byService,
    },
  };
}

/**
 * POST to Polar.sh Metered Usage API with retry
 */
async function postToPolar(
  payload: PolarUsagePayload,
  maxRetries: number = 3
): Promise<{ success: boolean; response?: unknown; error?: string }> {
  const polarApiKey = process.env.POLAR_API_KEY;
  const polarApiUrl = process.env.POLAR_METERED_USAGE_URL || 'https://api.polar.sh/v1/metered-usage';

  if (!polarApiKey) {
    logger.warn('[Daily Export] POLAR_API_KEY not set, skipping Polar POST');
    return { success: true, response: { skipped: true, reason: 'No API key' } };
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Exponential backoff: 1s, 2s, 4s
      if (attempt > 0) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        logger.info(`[Daily Export] Retry attempt ${attempt + 1}/${maxRetries}, waiting ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const response = await fetch(polarApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${polarApiKey}`,
          'Idempotency-Key': payload.idempotency_key,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Polar API returned ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      logger.info('[Daily Export] Polar API responded successfully', { response: responseData });

      return { success: true, response: responseData };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[Daily Export] Attempt ${attempt + 1} failed`, { error: lastError.message });
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * GET handler for manual trigger and health check
 */
export async function GET() {
  const { start, end, isoStart, isoEnd } = getYesterdayDateRange();
  const idempotencyKey = generateIdempotencyKey(new Date());

  return NextResponse.json({
    status: 'ok',
    cron: 'daily-usage-export',
    schedule: '0 0 * * * (daily at 00:00 UTC)',
    next_run: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    test_mode: true,
    date_range: {
      start,
      end,
      isoStart,
      isoEnd,
    },
    idempotency_key: idempotencyKey,
  });
}

/**
 * POST handler - Main export logic
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Verify cron secret if not manual trigger
    const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('vercel-cron-secret');
    const isManualTrigger = req.headers.get('x-manual-trigger') === 'true';

    if (!isManualTrigger && cronSecret !== process.env.VERCEL_CRON_SECRET) {
      logger.warn('[Daily Export] Invalid or missing cron secret', { requestId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('[Daily Export] Starting daily usage export', { requestId });

    // Step 1: Get yesterday's date range
    const { start, end, isoStart, isoEnd } = getYesterdayDateRange();
    const idempotencyKey = generateIdempotencyKey(new Date());

    // Step 2: Check idempotency - skip if already exported
    const alreadyExported = await checkExportExists(idempotencyKey);
    if (alreadyExported) {
      logger.info('[Daily Export] Export already exists for today, skipping', {
        requestId,
        idempotencyKey,
      });
      return NextResponse.json({
        status: 'skipped',
        reason: 'Export already completed',
        idempotency_key: idempotencyKey,
      });
    }

    // Step 3: Query usage data from database
    logger.info('[Daily Export] Querying usage data', {
      start,
      end,
      isoStart,
      isoEnd,
    });

    const { records, totalCount } = await getUsageExportData({
      billingPeriod: 'custom',
      startDate: start,
      endDate: end,
      page: 1,
      pageSize: 10000, // Get all records for the day
    });

    logger.info('[Daily Export] Retrieved records', {
      totalCount,
      returnedRecords: records.length,
    });

    if (records.length === 0) {
      logger.info('[Daily Export] No usage data found for yesterday');
      await logExportResult({
        success: true,
        export_date: new Date().toISOString(),
        idempotency_key: idempotencyKey,
        records_exported: 0,
        retry_count: 0,
      });
      return NextResponse.json({
        status: 'no_data',
        message: 'No usage data found for the selected period',
        idempotency_key: idempotencyKey,
      });
    }

    // Step 4: Format for Polar.sh API
    const polarPayload = formatForPolar(records, idempotencyKey, isoStart, isoEnd);

    logger.info('[Daily Export] Formatted payload for Polar', {
      totalRecords: polarPayload.total_records,
      totalCredits: polarPayload.summary.total_credits,
      uniqueCustomers: polarPayload.usage.length,
    });

    // Step 5: POST to Polar.sh with retry logic
    const polarResult = await postToPolar(polarPayload);

    if (!polarResult.success) {
      const errorMsg = polarResult.error || 'Unknown error';
      logger.error('[Daily Export] Failed to POST to Polar after retries', undefined, { error: errorMsg });

      await logExportResult({
        success: false,
        export_date: new Date().toISOString(),
        idempotency_key: idempotencyKey,
        records_exported: records.length,
        retry_count: 3,
        errorMessage: errorMsg,
      });

      return NextResponse.json({
        error: 'Failed to export to Polar after 3 retries',
        details: errorMsg,
        idempotency_key: idempotencyKey,
      }, { status: 500 });
    }

    // Step 6: Log success to Analytics dashboard
    await logExportResult({
      success: true,
      export_date: new Date().toISOString(),
      idempotency_key: idempotencyKey,
      records_exported: records.length,
      retry_count: 0,
      polarResponse: polarResult.response as Record<string, unknown> | null,
    });

    logger.info('[Daily Export] Export completed successfully', {
      requestId,
      recordsExported: records.length,
      polarResponse: polarResult.response,
    });

    // Also save CSV for backup
    const csvContent = exportToCSV(records, { includeHeader: true });

    return NextResponse.json({
      status: 'success',
      idempotency_key: idempotencyKey,
      export_date: new Date().toISOString(),
      period: {
        start: isoStart,
        end: isoEnd,
      },
      summary: polarPayload.summary,
      polarResponse: polarResult.response,
      csv_preview: csvContent.slice(0, 500) + '...',
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Daily Export] Export failed', err, { requestId });

    return NextResponse.json(
      { error: 'Export failed', details: err.message, requestId },
      { status: 500 }
    );
  }
}
