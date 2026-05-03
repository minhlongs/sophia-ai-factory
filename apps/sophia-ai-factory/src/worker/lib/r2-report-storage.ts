/**
 * R2 Report Storage Service
 *
 * Handles reading/writing reconciliation reports to Cloudflare R2 bucket.
 * Read/list/cleanup/download ops extracted to r2-report-read-ops.ts.
 *
 * @module worker/r2-report-storage
 */

import type { ReconciliationReport } from '@/seed/types/billing-contracts';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export {
  getReconciliationReport,
  listReconciliationReports,
  cleanupOldReports,
  getReportDownloadUrl,
} from './r2-report-read-ops';

export type { R2ReportMetadata } from '@/seed/types/billing-contracts';

/**
 * Store reconciliation report in R2.
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

    logger.info('[R2 Storage] Report stored', { key, size: reportJson.length, totalAmount: report.totalAmount });
    return key;
  } catch (error) {
    logger.error('[R2 Storage] Failed to store report', toError(error), { key });
    throw error;
  }
}
