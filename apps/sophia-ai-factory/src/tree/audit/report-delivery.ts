/**
 * Report Delivery System — barrel re-export
 *
 * Sub-modules:
 *   report-email-delivery.ts   — EmailConfig, emailReport
 *   report-storage-delivery.ts — storeReport, downloadStoredReport
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError, getErrorMessage } from '@/seed/utils/to-error'
import { emailReport } from '@/tree/audit/report-email-delivery'
import { storeReport, downloadStoredReport } from '@/tree/audit/report-storage-delivery'
import type { ScheduledReport } from '@/tree/audit/report-scheduler'
import type { AuditComplianceReportRow } from '@/tree/audit/types'

export type { EmailConfig } from './report-email-delivery'
export { emailReport, storeReport, downloadStoredReport }

/** Report delivery result */
export interface DeliveryResult {
  delivered: boolean
  errors?: string[]
  method?: string
  recipients?: string[]
}

/** Report metadata */
export interface ReportMetadata {
  id: string
  type: string
  format: string
  generatedAt: number
  generatedBy: string
  scheduleId?: string
  storagePath?: string
  fileSize?: number
}

export async function deliverReport(
  report: ScheduledReport,
  content: Buffer | string
): Promise<DeliveryResult> {
  const errors: string[] = []
  const deliveredRecipients: string[] = []

  try {
    const timestamp = new Date().toISOString().split('T')[0]
    const extension = report.format === 'pdf' ? 'pdf' : report.format
    const filename = `compliance-report-${report.type}-${timestamp}.${extension}`
    const subject = `[Sophia AI Factory] ${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report - ${timestamp}`

    try {
      await emailReport(report.recipients, subject, content, filename)
      deliveredRecipients.push(...report.recipients)
    } catch (emailError) {
      errors.push(`Email delivery failed: ${getErrorMessage(emailError)}`)
    }

    logger.info('[Report Delivery] Report delivery completed', {
      reportId: report.id,
      type: report.type,
      format: report.format,
      recipients: report.recipients,
      errors: errors.length > 0 ? errors : undefined
    })

    return {
      delivered: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      method: 'email',
      recipients: deliveredRecipients
    }
  } catch (error) {
    logger.error('[Report Delivery] Deliver report failed', toError(error))
    return {
      delivered: false,
      errors: [toError(error).message]
    }
  }
}

export async function getGeneratedReports(
  adminId: string,
  limit: number = 50
): Promise<ReportMetadata[]> {
  const db = await import('@/seed/db/client').then((m) => m.createServerClient())

  try {
    const result = await db.from<AuditComplianceReportRow>('compliance_reports')
      .select('*')
      .eq('generated_by', adminId)
      .order('generated_at', { ascending: false })
      .limit(limit)

    if (result.error) {
      logger.error('[Report Delivery] Get reports failed', new Error(result.error.message))
      throw new Error(result.error.message)
    }

    return (result.data || []).map((row: AuditComplianceReportRow) => ({
      id: row.id,
      type: row.report_type,
      format: row.format,
      generatedAt: row.generated_at,
      generatedBy: row.generated_by,
      scheduleId: row.schedule_id ?? undefined,
      storagePath: row.storage_path ?? undefined,
      fileSize: row.file_size ?? undefined
    }))
  } catch (error) {
    logger.error('[Report Delivery] Get generated reports failed', toError(error))
    throw error
  }
}
