/**
 * R2 Report Read Operations — retrieve, list, cleanup, and download URLs.
 * Do not import from r2-report-storage.ts here.
 *
 * @module worker/r2-report-read-ops
 */

import type { ReconciliationReport, R2ReportMetadata } from '@/seed/types/billing-contracts';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

/** Retrieve reconciliation report from R2. Returns null if not found. */
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
    logger.debug('[R2 Storage] Report retrieved', { key, size: content.length });
    return report;
  } catch (error) {
    logger.error('[R2 Storage] Failed to retrieve report', toError(error), { key });
    return null;
  }
}

/** List reconciliation reports from R2. Returns array of report metadata. */
export async function listReconciliationReports(
  bucket: R2Bucket,
  options?: { prefix?: string; limit?: number; cursor?: string }
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

    logger.debug('[R2 Storage] Listed reports', { count: reports.length, hasMore: !!listed.truncated });
    return reports;
  } catch (error) {
    logger.error('[R2 Storage] Failed to list reports', toError(error));
    return [];
  }
}

/**
 * Delete old reconciliation reports (retention policy).
 *
 * @param retentionDays - Days to retain (default: 90)
 * @returns Number of reports deleted
 */
export async function cleanupOldReports(bucket: R2Bucket, retentionDays: number = 90): Promise<number> {
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
 * Get report download URL (for admin dashboard).
 * For private buckets this returns a proxy URL; implement signed URLs per R2 config.
 */
export async function getReportDownloadUrl(
  bucket: R2Bucket,
  key: string,
  _expiresIn: number = 3600
): Promise<string | null> {
  try {
    const object = await bucket.get(key);
    if (!object) return null;
    return `/api/admin/audit/reports/download/${encodeURIComponent(key)}`;
  } catch (error) {
    logger.error('[R2 Storage] Failed to get download URL', toError(error), { key });
    return null;
  }
}
