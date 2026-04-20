/**
 * Cron Job Handler for Scheduled Reports
 *
 * Executes scheduled compliance reports based on their frequency:
 * - Daily: Every 24 hours
 * - Weekly: Every 7 days
 * - Monthly: Same day each month
 * - Quarterly: Same day every 3 months
 *
 * Run via cron job or serverless schedule (e.g., GitHub Actions, Cloudflare Cron Triggers)
 *
 * @module audit/cron-report-runner
 */

import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import {
  getDueReports,
  updateNextRunAt,
  type ScheduledReport
} from './report-scheduler'
import { generateReport, type ComplianceReportData } from './pdf-report-generator'
import { deliverReport, storeReport } from './report-delivery'
import { createServerClient } from '@/lib/db/client'
import { calculateNextRunAt } from './report-scheduler'
import type {
  RaasAuditLogRow,
  AuditLicenseRow,
  AuditUsageEventRow,
  AuditHashChainRow,
} from './types'

/**
 * Result from running scheduled reports
 */
export interface RunResult {
  /** Number of reports executed successfully */
  executed: number
  /** Number of reports that failed */
  errors: number
  /** Details of each execution */
  details: ExecutionDetail[]
}

/**
 * Execution detail for each report
 */
export interface ExecutionDetail {
  reportId: string
  type: string
  format: string
  success: boolean
  error?: string
  recipients?: string[]
  storageUrl?: string
}

/**
 * Fetch audit data for compliance report
 */
async function fetchComplianceData(
  filters: { startDate?: number; endDate?: number; licenseNonce?: string }
): Promise<ComplianceReportData> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)

  // Default to last 30 days if no dates specified
  const startDate = filters.startDate || now - 30 * 24 * 60 * 60
  const endDate = filters.endDate || now

  try {
    // Fetch audit logs count
    const logsQuery = db.from<RaasAuditLogRow>('raas_audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (filters.licenseNonce) {
      logsQuery.eq('license_nonce', filters.licenseNonce)
    }

    const { count: totalLogs } = await logsQuery

    // Fetch hash chain verification status
    const hashChainQuery = await db.from<AuditHashChainRow>('raas_audit_logs')
      .select('content_hash, hash_chain_valid')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
      .limit(1)

    const firstLog = hashChainQuery.data?.[0]

    const hashChainQueryEnd = await db.from<AuditHashChainRow>('raas_audit_logs')
      .select('content_hash')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(1)

    const lastLog = hashChainQueryEnd.data?.[0]

    // Fetch license breakdown
    const licenseQuery = await db.from<AuditLicenseRow>('raas_licenses')
      .select('nonce, tier, created_at, last_used_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const licenses = licenseQuery.data || []

    // Fetch usage statistics per license
    const usageQuery = await db.from<AuditUsageEventRow>('raas_usage_events')
      .select('license_nonce, model_name, token_count, tokens_input, tokens_output')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const usageEvents = usageQuery.data || []

    // Aggregate model breakdown
    const modelBreakdownMap = new Map<
      string,
      { invocations: number; tokensProcessed: number; tokensInput: number; tokensOutput: number }
    >()

    for (const event of usageEvents) {
      const key = event.model_name || 'unknown'
      const existing = modelBreakdownMap.get(key) || {
        invocations: 0,
        tokensProcessed: 0,
        tokensInput: 0,
        tokensOutput: 0
      }
      modelBreakdownMap.set(key, {
        invocations: existing.invocations + 1,
        tokensProcessed:
          existing.tokensProcessed + (event.token_count || 0),
        tokensInput: existing.tokensInput + (event.tokens_input || 0),
        tokensOutput: existing.tokensOutput + (event.tokens_output || 0)
      })
    }

    const modelBreakdown = Array.from(modelBreakdownMap.entries()).map(
      ([modelName, stats]) => ({
        modelName,
        invocations: stats.invocations,
        tokensProcessed: stats.tokensProcessed,
        tokensInput: stats.tokensInput,
        tokensOutput: stats.tokensOutput
      })
    )

    // Count validations per license
    const validationQuery = await db.from<{ license_nonce: string }>('raas_audit_logs')
      .select('license_nonce')
      .eq('action', 'VALIDATE')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const validationCounts = new Map<string, number>()
    for (const log of validationQuery.data || []) {
      const nonce = log.license_nonce
      validationCounts.set(nonce, (validationCounts.get(nonce) || 0) + 1)
    }

    // Count usage credits per license
    const usageCounts = new Map<string, number>()
    for (const event of usageEvents) {
      const nonce = event.license_nonce
      usageCounts.set(nonce, (usageCounts.get(nonce) || 0) + (event.token_count || 0))
    }

    // Build license report data
    const licenseReportData = licenses.map((lic: AuditLicenseRow) => ({
      nonce: lic.nonce,
      tier: lic.tier,
      validationCount: validationCounts.get(lic.nonce) || 0,
      usageCredits: usageCounts.get(lic.nonce) || 0,
      createdAt: new Date(lic.created_at * 1000).toISOString(),
      lastUsedAt: lic.last_used_at
        ? new Date(lic.last_used_at * 1000).toISOString()
        : undefined
    }))

    return {
      reportId: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      generatedBy: 'system-cron',
      period: {
        start: new Date(startDate * 1000),
        end: new Date(endDate * 1000)
      },
      summary: {
        totalLogs: totalLogs || 0,
        hashChainValid: firstLog?.hash_chain_valid ?? true,
        totalLicenses: licenses.length,
        totalUsage: usageEvents.length,
        periodStart: new Date(startDate * 1000),
        periodEnd: new Date(endDate * 1000)
      },
      licenses: licenseReportData,
      modelBreakdown,
      hashChainVerification: {
        firstHash: firstLog?.content_hash || 'N/A',
        lastHash: lastLog?.content_hash || 'N/A',
        totalLogs: totalLogs || 0,
        verified: firstLog?.hash_chain_valid ?? true
      }
    }
  } catch (error) {
    logger.error('[Cron Runner] Fetch compliance data failed', toError(error))
    throw error
  }
}

/**
 * Generate and deliver a single scheduled report
 *
 * @param report - Scheduled report configuration
 */
export async function generateAndDeliverReport(
  report: ScheduledReport
): Promise<void> {
  logger.info('[Cron Runner] Generating scheduled report', {
    reportId: report.id,
    type: report.type,
    frequency: report.frequency
  })

  try {
    // Fetch compliance data from database
    const complianceData = await fetchComplianceData({
      startDate: report.filters.startDate,
      endDate: report.filters.endDate,
      licenseNonce: report.filters.licenseNonce
    })

    // Generate report in specified format
    const reportContent = generateReport(complianceData, report.format)

    // Deliver via email
    const deliveryResult = await deliverReport(report, Buffer.from(reportContent))

    if (!deliveryResult.delivered) {
      throw new Error(`Delivery failed: ${deliveryResult.errors?.join(', ')}`)
    }

    // Store for download (optional)
    const storageUrl = await storeReport(
      complianceData.reportId,
      reportContent,
      report.format
    )

    // Update next run timestamp
    const nextRunAt = Math.floor(calculateNextRunAt(report.frequency) / 1000)
    await updateNextRunAt(report.id, nextRunAt)

    logger.info('[Cron Runner] Report generated and delivered', {
      reportId: report.id,
      storageUrl
    })
  } catch (error) {
    logger.error('[Cron Runner] Generate and deliver failed', toError(error))
    throw error
  }
}

/**
 * Run all due scheduled reports
 *
 * Call this function from a cron job (e.g., every hour)
 * to execute all reports that are due.
 *
 * @returns Execution result with counts and details
 *
 * @example
 * // Run via cron (every hour)
 * // 0 * * * * node -e "import('./cron-report-runner').then(m => m.runScheduledReports())"
 *
 * const result = await runScheduledReports()
 * console.log(`Executed: ${result.executed}, Errors: ${result.errors}`)
 */
export async function runScheduledReports(): Promise<RunResult> {
  logger.info('[Cron Runner] Starting scheduled report execution')

  const details: ExecutionDetail[] = []
  let executed = 0
  let errors = 0

  try {
    // Get all due reports
    const dueReports = await getDueReports()

    if (dueReports.length === 0) {
      logger.info('[Cron Runner] No reports due')
      return { executed: 0, errors: 0, details: [] }
    }

    logger.info('[Cron Runner] Reports due', { count: dueReports.length })

    // Execute each report
    for (const report of dueReports) {
      const detail: ExecutionDetail = {
        reportId: report.id,
        type: report.type,
        format: report.format,
        success: false
      }

      try {
        await generateAndDeliverReport(report)
        detail.success = true
        detail.recipients = report.recipients
        executed++
      } catch (error) {
        detail.error = toError(error).message
        errors++
        logger.error('[Cron Runner] Report execution failed', {
          reportId: report.id,
          errorMessage: error instanceof Error ? error.message : String(error)
        })
      }

      details.push(detail)
    }

    logger.info('[Cron Runner] Execution complete', {
      executed,
      errors,
      total: dueReports.length
    })

    return { executed, errors, details }
  } catch (error) {
    logger.error('[Cron Runner] Run scheduled reports failed', toError(error))
    return {
      executed,
      errors: errors + 1,
      details
    }
  }
}

/**
 * CLI entry point for cron execution
 * Run with: npx tsx src/lib/audit/cron-report-runner.ts
 */
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

// Run if executed directly
if (require.main === module) {
  main()
}
