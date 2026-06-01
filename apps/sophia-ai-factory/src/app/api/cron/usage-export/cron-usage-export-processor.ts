/**
 * Per-license export processor for usage export cron
 * @module app/api/cron/usage-export/cron-usage-export-processor
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { getUsageExportData } from '@/land/usage-export/export-service'
import { logUsageWithReceipt } from '@/tree/audit/audit-logger'
import { storeExportReceipt } from './cron-usage-export-db'
import type { RaasLicenseRow } from '@/land/supabase/types'

export async function processLicenseExport(
  license: RaasLicenseRow,
  startTimestamp: number,
  endTimestamp: number,
): Promise<{ success: boolean; recordCount: number; format: 'json'; errorMessage?: string }> {
  try {
    const exportData = await getUsageExportData({
      billingPeriod: 'custom',
      startDate: startTimestamp,
      endDate: endTimestamp,
      licenseNonce: license.nonce,
      page: 1,
      pageSize: 10000,
    })
    const recordCount = exportData.records.length
    const auditReceipt = await logUsageWithReceipt({
      nonce: license.nonce, model_name: 'usage-export-cron',
      token_count: recordCount, endpoint: '/api/cron/usage-export', tier: license.tier,
    })
    logger.info('[Usage Export Cron] Processed license', {
      nonce: license.nonce.slice(0, 8), tier: license.tier, recordCount, auditReceiptId: auditReceipt?.receiptId,
    })
    await storeExportReceipt({ licenseNonce: license.nonce, recordCount, format: 'json', periodStart: startTimestamp, periodEnd: endTimestamp, success: true })
    return { success: true, recordCount, format: 'json' }
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    logger.error('[Usage Export Cron] Failed to process license', error instanceof Error ? error : new Error(String(error)), { nonce: license.nonce.slice(0, 8) })
    await storeExportReceipt({ licenseNonce: license.nonce, recordCount: 0, format: 'json', periodStart: startTimestamp, periodEnd: endTimestamp, success: false, errorMessage })
    return { success: false, recordCount: 0, format: 'json', errorMessage }
  }
}
