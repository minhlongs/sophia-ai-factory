/**
 * Cron Job Handler for Scheduled Reports.
 *
 * @edge-runtime-allowed: process.exit() lives inside main() which only
 * runs when this file is executed directly via require.main === module
 * (Node CLI). The module's exported functions never call process.exit.
 *
 * @module audit/cron-report-runner
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError, getErrorMessage } from '@/seed/utils/to-error'
import { getDueReports, updateNextRunAt, calculateNextRunAt, type ScheduledReport } from '@/tree/audit/report-scheduler'
import { generateReport } from '@/tree/audit/pdf-report-generator'
import { deliverReport, storeReport } from '@/tree/audit/report-delivery'
import { fetchComplianceData } from '@/tree/audit/cron-report-runner-data-fetcher'
import type { RunResult, ExecutionDetail } from '@/tree/audit/cron-report-runner-types'

export type { RunResult, ExecutionDetail } from './cron-report-runner-types'

export async function generateAndDeliverReport(report: ScheduledReport): Promise<void> {
  logger.info('[Cron Runner] Generating scheduled report', { reportId: report.id, type: report.type, frequency: report.frequency })

  try {
    const complianceData = await fetchComplianceData({
      startDate: report.filters.startDate,
      endDate: report.filters.endDate,
      licenseNonce: report.filters.licenseNonce
    })

    const reportContent = generateReport(complianceData, report.format)
    const deliveryResult = await deliverReport(report, Buffer.from(reportContent))

    if (!deliveryResult.delivered) {
      throw new Error(`Delivery failed: ${deliveryResult.errors?.join(', ')}`)
    }

    const storageUrl = await storeReport(complianceData.reportId, reportContent, report.format)
    const nextRunAt = Math.floor(calculateNextRunAt(report.frequency) / 1000)
    await updateNextRunAt(report.id, nextRunAt)

    logger.info('[Cron Runner] Report generated and delivered', { reportId: report.id, storageUrl })
  } catch (error) {
    logger.error('[Cron Runner] Generate and deliver failed', toError(error))
    throw error
  }
}

export async function runScheduledReports(): Promise<RunResult> {
  logger.info('[Cron Runner] Starting scheduled report execution')

  const details: ExecutionDetail[] = []
  let executed = 0
  let errors = 0

  try {
    const dueReports = await getDueReports()

    if (dueReports.length === 0) {
      logger.info('[Cron Runner] No reports due')
      return { executed: 0, errors: 0, details: [] }
    }

    logger.info('[Cron Runner] Reports due', { count: dueReports.length })

    for (const report of dueReports) {
      const detail: ExecutionDetail = { reportId: report.id, type: report.type, format: report.format, success: false }

      try {
        await generateAndDeliverReport(report)
        detail.success = true
        detail.recipients = report.recipients
        executed++
      } catch (error) {
        detail.error = toError(error).message
        errors++
        logger.error('[Cron Runner] Report execution failed', { reportId: report.id, errorMessage: getErrorMessage(error) })
      }

      details.push(detail)
    }

    logger.info('[Cron Runner] Execution complete', { executed, errors, total: dueReports.length })
    return { executed, errors, details }
  } catch (error) {
    logger.error('[Cron Runner] Run scheduled reports failed', toError(error))
    return { executed, errors: errors + 1, details }
  }
}

async function main() {
  try {
    const result = await runScheduledReports()
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    process.exit(result.errors > 0 ? 1 : 0)
  } catch (error) {
    process.stderr.write('Fatal error: ' + error + '\n')
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
