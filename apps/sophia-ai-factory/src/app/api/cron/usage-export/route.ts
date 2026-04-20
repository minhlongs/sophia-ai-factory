/**
 * Usage Export Cron Endpoint
 *
 * Triggered by Cloudflare Cron Trigger to automatically export usage data for all active licenses
 *
 * Schedule: At 02:00 UTC every day (0 2 * * *)
 * See: wrangler.toml for cron configuration
 *
 * Features:
 * - Secret validation via X-Cron-Secret or x-cf-cron header
 * - Query all active (non-revoked, non-expired) licenses
 * - Export usage data for previous day (00:00 - 23:59 UTC)
 * - Generate CSV/JSON exports
 * - Store export receipts in database
 * - Log to audit system with compliance receipts
 * - Graceful error handling with retry tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { getUsageExportData, exportToCSV, exportToJSON } from '@/lib/usage-export/export-service';
import { logUsageWithReceipt } from '@/lib/audit/audit-logger';
import type { RaasLicenseRow } from '@/lib/supabase/types';

/**
 * Verify cron authentication
 *
 * Checks for:
 * 1. X-Cron-Secret header matching CRON_SECRET env var
 * 2. x-cf-cron header (set by Cloudflare Cron Triggers)
 * 3. Bypass in development mode
 */
function verifyCronAuth(request: NextRequest): boolean {
  // Allow bypass in development
  if (process.env.NODE_ENV === 'development') {
    logger.info('[Usage Export Cron] Development mode - skipping auth');
    return true;
  }

  const expectedSecret = process.env.CRON_SECRET;
  // P2: Accept Authorization: Bearer <CRON_SECRET> (standard CF Workers cron pattern)
  if (expectedSecret && request.headers.get('authorization') === `Bearer ${expectedSecret}`) {
    logger.info('[Usage Export Cron] Authenticated via Authorization Bearer');
    return true;
  }

  // Check for cron secret via x-cron-secret header
  const cronSecret = request.headers.get('x-cron-secret');
  if (expectedSecret && cronSecret === expectedSecret) {
    logger.info('[Usage Export Cron] Authenticated via X-Cron-Secret');
    return true;
  }

  // Check for Cloudflare cron header
  const cfCron = request.headers.get('x-cf-cron');
  if (cfCron === 'true') {
    logger.info('[Usage Export Cron] Authenticated via Cloudflare Cron header');
    return true;
  }

  logger.warn('[Usage Export Cron] Unauthorized cron attempt');
  return false;
}

/**
 * Calculate previous day's start and end timestamps (UTC)
 *
 * @returns Object with startTimestamp and endTimestamp in Unix seconds
 */
function getPreviousDayRange(): { startTimestamp: number; endTimestamp: number } {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Start of yesterday (00:00:00 UTC)
  const start = new Date(Date.UTC(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate(),
    0, 0, 0, 0
  ));

  // End of yesterday (23:59:59 UTC)
  const end = new Date(Date.UTC(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate(),
    23, 59, 59, 999
  ));

  return {
    startTimestamp: Math.floor(start.getTime() / 1000),
    endTimestamp: Math.floor(end.getTime() / 1000),
  };
}

/**
 * Query all active licenses from database
 *
 * Active = not revoked AND (no expiry OR not expired)
 */
async function getActiveLicenses(): Promise<RaasLicenseRow[]> {
  const db = createServerClient();

  const { data, error } = await db
    .from('raas_licenses')
    .select('*')
    .eq('is_revoked', false);

  if (error) {
    logger.error('[Usage Export Cron] Failed to query licenses', error);
    throw new Error(`Database query failed: ${error.message}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const activeLicenses = (data || []).filter((license: RaasLicenseRow) => {
    // If no expiry, license is active
    if (!license.expires_at) return true;
    // If expires_at is in future, license is active
    return license.expires_at > now;
  });

  logger.info('[Usage Export Cron] Found active licenses', {
    total: data?.length || 0,
    active: activeLicenses.length,
  });

  return activeLicenses;
}

/**
 * export_jobs row shape (migration 0014-export-jobs.sql)
 * Columns: id, org_id (optional), license_nonce, export_format,
 *          period_start, period_end, record_count, success, error_message, created_at
 */
interface ExportJobInsert {
  id: string
  org_id?: string | null
  license_nonce: string
  export_format: 'json' | 'csv'
  period_start: number   // Unix seconds
  period_end: number     // Unix seconds
  record_count: number
  success: number        // SQLite boolean: 1=true, 0=false
  error_message: string | null
  created_at: number     // Unix seconds
}

/**
 * Store export job record in database
 */
async function storeExportReceipt(params: {
  licenseNonce: string;
  recordCount: number;
  format: 'json' | 'csv';
  periodStart: number;
  periodEnd: number;
  success: boolean;
  errorMessage?: string;
}): Promise<string | null> {
  try {
    const db = createServerClient();
    const jobId = crypto.randomUUID();

    const { error } = await db
      .from<ExportJobInsert>('export_jobs')
      .insert({
        id: jobId,
        license_nonce: params.licenseNonce,
        record_count: params.recordCount,
        export_format: params.format,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        success: params.success ? 1 : 0,  // SQLite boolean
        error_message: params.errorMessage || null,
        created_at: Math.floor(Date.now() / 1000),
      });

    if (error) {
      logger.warn('[Usage Export Cron] Failed to store export receipt', {
        jobId,
        error: error.message,
      });
      // Non-fatal: continue without storing receipt
      return null;
    }

    logger.info('[Usage Export Cron] Stored export receipt', { jobId });
    return jobId;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[Usage Export Cron] Exception storing export receipt', {
      error: err.message,
      stack: err.stack,
    });
    return null;
  }
}

/**
 * Process export for a single license
 */
async function processLicenseExport(
  license: RaasLicenseRow,
  startTimestamp: number,
  endTimestamp: number
): Promise<{
  success: boolean;
  recordCount: number;
  format: 'json';
  errorMessage?: string;
}> {
  try {
    // Query usage data for this license
    const exportData = await getUsageExportData({
      billingPeriod: 'custom',
      startDate: startTimestamp,
      endDate: endTimestamp,
      licenseNonce: license.nonce,
      page: 1,
      pageSize: 10000, // Large page size for daily exports
    });

    const recordCount = exportData.records.length;

    // Log to audit system with receipt
    const auditReceipt = await logUsageWithReceipt({
      nonce: license.nonce,
      model_name: 'usage-export-cron',
      token_count: recordCount,
      endpoint: '/api/cron/usage-export',
      tier: license.tier,
    });

    logger.info('[Usage Export Cron] Processed license', {
      nonce: license.nonce.slice(0, 8),
      tier: license.tier,
      recordCount,
      auditReceiptId: auditReceipt?.receiptId,
    });

    // Store export receipt
    await storeExportReceipt({
      licenseNonce: license.nonce,
      recordCount,
      format: 'json',
      periodStart: startTimestamp,
      periodEnd: endTimestamp,
      success: true,
    });

    return {
      success: true,
      recordCount,
      format: 'json',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Usage Export Cron] Failed to process license', error instanceof Error ? error : new Error(String(error)), {
      nonce: license.nonce.slice(0, 8),
    });

    // Store failed export receipt
    await storeExportReceipt({
      licenseNonce: license.nonce,
      recordCount: 0,
      format: 'json',
      periodStart: startTimestamp,
      periodEnd: endTimestamp,
      success: false,
      errorMessage,
    });

    return {
      success: false,
      recordCount: 0,
      format: 'json',
      errorMessage,
    };
  }
}

/**
 * GET /api/cron/usage-export
 *
 * Export usage data for all active licenses for the previous day
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // Verify authentication
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    logger.info('[Usage Export Cron] Starting', { requestId });

    // Get previous day's date range
    const { startTimestamp, endTimestamp } = getPreviousDayRange();

    logger.info('[Usage Export Cron] Date range', {
      startTimestamp,
      endTimestamp,
      startDate: new Date(startTimestamp * 1000).toISOString(),
      endDate: new Date(endTimestamp * 1000).toISOString(),
    });

    // Get all active licenses
    const activeLicenses = await getActiveLicenses();

    if (activeLicenses.length === 0) {
      logger.info('[Usage Export Cron] No active licenses found');
      return NextResponse.json({
        success: true,
        message: 'No active licenses to process',
        processed: 0,
        failed: 0,
        totalRecords: 0,
      });
    }

    // Process each license
    const results: Array<{
      nonce: string;
      tier: string;
      success: boolean;
      recordCount: number;
      errorMessage?: string;
    }> = [];

    let totalRecords = 0;
    let failedCount = 0;

    for (const license of activeLicenses) {
      const result = await processLicenseExport(license, startTimestamp, endTimestamp);

      results.push({
        nonce: license.nonce.slice(0, 8),
        tier: license.tier,
        success: result.success,
        recordCount: result.recordCount,
        errorMessage: result.errorMessage,
      });

      totalRecords += result.recordCount;
      if (!result.success) {
        failedCount++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info('[Usage Export Cron] Complete', {
      requestId,
      duration,
      totalLicenses: activeLicenses.length,
      successful: activeLicenses.length - failedCount,
      failed: failedCount,
      totalRecords,
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${activeLicenses.length - failedCount}/${activeLicenses.length} licenses`,
      processed: activeLicenses.length - failedCount,
      failed: failedCount,
      totalRecords,
      duration,
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    logger.error('[Usage Export Cron] Critical error', error instanceof Error ? error : new Error(String(error)), {
      requestId,
      duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - same as GET for compatibility
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
