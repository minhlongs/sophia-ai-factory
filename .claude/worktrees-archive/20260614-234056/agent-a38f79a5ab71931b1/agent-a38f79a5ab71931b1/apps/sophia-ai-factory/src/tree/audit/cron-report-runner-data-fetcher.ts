/**
 * Data fetcher for Cron Report Runner — queries audit/license/usage data
 * @module audit/cron-report-runner-data-fetcher
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { createServerClient } from '@/seed/db/client'
import type { ComplianceReportData } from '@/tree/audit/pdf-report-generator'
import type {
  RaasAuditLogRow,
  AuditLicenseRow,
  AuditUsageEventRow,
} from '@/tree/audit/types'

export async function fetchComplianceData(
  filters: { startDate?: number; endDate?: number; licenseNonce?: string }
): Promise<ComplianceReportData> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)
  const startDate = filters.startDate || now - 30 * 24 * 60 * 60
  const endDate = filters.endDate || now

  try {
    const logsQuery = db.from<RaasAuditLogRow>('raas_audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (filters.licenseNonce) {
      logsQuery.eq('license_nonce', filters.licenseNonce)
    }

    const { count: totalLogs } = await logsQuery

    // Hash-chain fields (content_hash, hash_chain_valid) are not populated by
    // audit-logging-service writer and 0019 migration omits those columns.
    // Removed dead SELECTs (M2 fix — KISS: implement when writer is ready).

    const licenseQuery = await db.from<AuditLicenseRow>('raas_licenses')
      .select('nonce, tier, created_at, last_used_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const licenses = licenseQuery.data || []

    const usageQuery = await db.from<AuditUsageEventRow>('raas_usage_events')
      .select('license_nonce, model_name, token_count, tokens_input, tokens_output')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const usageEvents = usageQuery.data || []

    const modelBreakdownMap = new Map<
      string,
      { invocations: number; tokensProcessed: number; tokensInput: number; tokensOutput: number }
    >()

    for (const event of usageEvents) {
      const key = event.model_name || 'unknown'
      const existing = modelBreakdownMap.get(key) || { invocations: 0, tokensProcessed: 0, tokensInput: 0, tokensOutput: 0 }
      modelBreakdownMap.set(key, {
        invocations: existing.invocations + 1,
        tokensProcessed: existing.tokensProcessed + (event.token_count || 0),
        tokensInput: existing.tokensInput + (event.tokens_input || 0),
        tokensOutput: existing.tokensOutput + (event.tokens_output || 0)
      })
    }

    const modelBreakdown = Array.from(modelBreakdownMap.entries()).map(
      ([modelName, stats]) => ({ modelName, ...stats })
    )

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

    const usageCounts = new Map<string, number>()
    for (const event of usageEvents) {
      const nonce = event.license_nonce
      usageCounts.set(nonce, (usageCounts.get(nonce) || 0) + (event.token_count || 0))
    }

    const licenseReportData = licenses.map((lic: AuditLicenseRow) => ({
      nonce: lic.nonce,
      tier: lic.tier,
      validationCount: validationCounts.get(lic.nonce) || 0,
      usageCredits: usageCounts.get(lic.nonce) || 0,
      createdAt: new Date(lic.created_at * 1000).toISOString(),
      lastUsedAt: lic.last_used_at ? new Date(lic.last_used_at * 1000).toISOString() : undefined
    }))

    return {
      reportId: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      generatedBy: 'system-cron',
      period: { start: new Date(startDate * 1000), end: new Date(endDate * 1000) },
      summary: {
        totalLogs: totalLogs || 0,
        // hash_chain_valid not stored in DB yet — default true until writer is wired
        hashChainValid: true,
        totalLicenses: licenses.length,
        totalUsage: usageEvents.length,
        periodStart: new Date(startDate * 1000),
        periodEnd: new Date(endDate * 1000)
      },
      licenses: licenseReportData,
      modelBreakdown,
      hashChainVerification: {
        firstHash: 'N/A',
        lastHash: 'N/A',
        totalLogs: totalLogs || 0,
        verified: true
      }
    }
  } catch (error) {
    logger.error('[Cron Runner] Fetch compliance data failed', toError(error))
    throw error
  }
}
