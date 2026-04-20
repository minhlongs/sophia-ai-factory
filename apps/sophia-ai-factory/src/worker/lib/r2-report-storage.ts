/**
 * R2 Report Storage Service
 *
 * Handles reading/writing reconciliation reports to Cloudflare R2 bucket.
 *
 * Features:
 * - JSON report storage with metadata
 * - 90-day retention policy
 * - Report listing with pagination
 * - Secure download URLs
 *
 * @module worker/r2-report-storage
 */

import type { ReconciliationReport, R2ReportMetadata } from '@/lib/billing/reconciliation-types';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

/**
 * Store reconciliation report in R2
 *
 * @param report - Reconciliation report to store
 * @param bucket - R2 bucket binding
 * @param prefix - Key prefix (default: 'reports/reconciliation-')
 * @returns R2 storage key
 */
export async function storeReconciliationReport(
  report: ReconciliationReport,
  bucket: R2Bucket,
  prefix: string = 'reports/reconciliation-'
): Promise<string> {
  const timestamp = new Date(report.timestamp).toISOString();
  const key = `${prefix}${timestamp}-${report.id}.json`;

  try {
    const reportJson = JSON.stringify(report, null, 2);

    await bucket.put(key, reportJson, {
      httpMetadata: {
        contentType: 'application/json',
        cacheControl: 'private, max-age=0',
      },
      customMetadata: {
        reportType: 'reconciliation',
        periodStart: new Date(report.periodStart * 1000).toISOString(),
        periodEnd: new Date(report.periodEnd * 1000).toISOString(),
        totalAmount: report.totalAmount.toString(),
        invoicesCreated: report.invoicesCreated.toString(),
        discrepanciesCount: report.discrepancies.length.toString(),
        errorsCount: report.errors.length.toString(),
      },
    });

    logger.info('[R2 Storage] Report stored', {
      key,
      size: reportJson.length,
      totalAmount: report.totalAmount,
    });

    return key;
  } catch (error) {
    logger.error('[R2 Storage] Failed to store report', toError(error), { key });
    throw error;
  }
}

/**
 * Retrieve reconciliation report from R2
 *
 * @param bucket - R2 bucket binding
 * @param key - Report storage key
 * @returns Parsed report or null if not found
 */
export async function getReconciliationReport(
  bucket: R2Bucket,
  key: string
): Promise<ReconciliationReport | null> {
  try {
    const object = await bucket.get(key);

    if (!object) {
      logger.debug('[R2 Storage] Report not found', { key });
      return null;
    }

    const content = await object.text();
    const report = JSON.parse(content) as ReconciliationReport;

    logger.debug('[R2 Storage] Report retrieved', {
      key,
      size: content.length,
    });

    return report;
  } catch (error) {
    logger.error('[R2 Storage] Failed to retrieve report', toError(error), { key });
    return null;
  }
}

/**
 * List reconciliation reports from R2
 *
 * @param bucket - R2 bucket binding
 * @param options - List options
 * @returns Array of report metadata
 */
export async function listReconciliationReports(
  bucket: R2Bucket,
  options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<R2ReportMetadata[]> {
  try {
    const listed = await bucket.list({
      prefix: options?.prefix || 'reports/reconciliation-',
      limit: options?.limit || 100,
      cursor: options?.cursor,
    });

    const reports: R2ReportMetadata[] = listed.objects.map((obj) => ({
      key: obj.key,
      uploaded: obj.uploaded,
      size: obj.size,
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
    }));

    logger.debug('[R2 Storage] Listed reports', {
      count: reports.length,
      hasMore: !!listed.truncated,
    });

    return reports;
  } catch (error) {
    logger.error('[R2 Storage] Failed to list reports', toError(error));
    return [];
  }
}

/**
 * Delete old reconciliation reports (retention policy)
 *
 * @param bucket - R2 bucket binding
 * @param retentionDays - Days to retain (default: 90)
 * @returns Number of reports deleted
 */
export async function cleanupOldReports(
  bucket: R2Bucket,
  retentionDays: number = 90
): Promise<number> {
  try {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const listed = await bucket.list({ prefix: 'reports/reconciliation-' });

    let deleted = 0;

    for (const obj of listed.objects) {
      if (obj.uploaded.getTime() < cutoff) {
        await bucket.delete(obj.key);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.info('[R2 Storage] Cleaned up old reports', {
        deleted,
        retentionDays,
        cutoffDate: new Date(cutoff).toISOString(),
      });
    }

    return deleted;
  } catch (error) {
    logger.error('[R2 Storage] Failed to cleanup old reports', toError(error));
    return 0;
  }
}

/**
 * Get report download URL (for admin dashboard)
 *
 * @param bucket - R2 bucket binding
 * @param key - Report storage key
 * @param expiresIn - URL expiration in seconds (default: 3600)
 * @returns Download URL or null if not found
 */
export async function getReportDownloadUrl(
  bucket: R2Bucket,
  key: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const object = await bucket.get(key);

    if (!object) {
      return null;
    }

    // For R2 public buckets, return direct URL
    // For private buckets, generate signed URL (requires additional setup)
    // This is a placeholder - implement signed URLs based on your R2 configuration
    return `/api/admin/audit/reports/download/${encodeURIComponent(key)}`;
  } catch (error) {
    logger.error('[R2 Storage] Failed to get download URL', toError(error), { key });
    return null;
  }
}
