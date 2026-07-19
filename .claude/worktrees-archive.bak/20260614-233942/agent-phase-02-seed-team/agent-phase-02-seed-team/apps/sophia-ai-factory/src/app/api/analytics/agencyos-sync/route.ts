/**
 * AgencyOS Analytics Sync API
 * POST /api/analytics/agencyos-sync — export quota/overage data
 * GET  /api/analytics/agencyos-sync — health check
 * @module api/analytics/agencyos-sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { verifyWebhookSignature } from '@/seed/security/webhook-validator'
import { fetchQuotaUsage, fetchOverageEvents, fetchTierHistory } from './agencyos-sync-data'

interface AgencyOSQuotaReport {
  agencyId: string; licenseNonce: string; periodStart: string; periodEnd: string
  totalCreditsUsed: number; totalOverageCredits: number; overageCharges: number
  tierHistory: Array<{ tier: string; startDate: string }>
  quotaViolations: Array<{ timestamp: string; type: string; exceededBy: number }>
  subscriptionStatus?: string
}

interface SyncRequestBody {
  agencyId: string; startDate: string; endDate: string
  includeOverageEvents?: boolean; includeTierHistory?: boolean
}

async function verifyAgencyOSAuth(request: NextRequest, body: string): Promise<boolean> {
  const signature = request.headers.get('x-agencyos-signature')
  const timestamp = request.headers.get('x-agencyos-timestamp')
  if (!signature || !timestamp) { logger.warn('[AgencyOS Sync] Missing auth headers'); return false }
  const secret = process.env.AGENCYOS_WEBHOOK_SECRET
  if (!secret) { logger.error('[AgencyOS Sync] AGENCYOS_WEBHOOK_SECRET not configured'); return false }
  return verifyWebhookSignature(body, signature, timestamp, secret)
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  // Read raw body first so HMAC verification can sign over actual payload
  let rawBody: string
  try { rawBody = await request.text() } catch { return NextResponse.json({ error: 'Failed to read request body', code: 'INVALID_BODY' }, { status: 400 }) }
  if (!await verifyAgencyOSAuth(request, rawBody)) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  let body: SyncRequestBody
  try { body = JSON.parse(rawBody) as SyncRequestBody } catch { return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 }) }

  const { agencyId, startDate, endDate, includeOverageEvents, includeTierHistory } = body
  if (!agencyId || !startDate || !endDate) return NextResponse.json({ error: 'Missing required fields: agencyId, startDate, endDate', code: 'MISSING_FIELDS' }, { status: 400 })

  logger.info('[AgencyOS Sync] Sync request received', { agencyId, startDate, endDate, includeOverageEvents, includeTierHistory })

  try {
    const db = createServerClient()
    const startTs = Math.floor(new Date(startDate).getTime() / 1000)
    const endTs = Math.floor(new Date(endDate).getTime() / 1000)

    const { data: licenses } = await db.from('raas_licenses').select('nonce, tier, created_by').eq('created_by', agencyId).eq('is_revoked', false)

    if (!licenses || licenses.length === 0) {
      logger.info('[AgencyOS Sync] No active licenses found for agency', { agencyId })
      return NextResponse.json({ agencyId, periodStart: startDate, periodEnd: endDate, licenses: [], syncTimestamp: new Date().toISOString() })
    }

    const reports: AgencyOSQuotaReport[] = []
    for (const license of licenses) {
      const quotaUsage = await fetchQuotaUsage(license.nonce as string, startTs, endTs)
      const report: AgencyOSQuotaReport = {
        agencyId, licenseNonce: license.nonce as string, periodStart: startDate, periodEnd: endDate,
        totalCreditsUsed: quotaUsage.totalCreditsUsed, totalOverageCredits: 0, overageCharges: 0,
        tierHistory: includeTierHistory ? await fetchTierHistory(license.nonce as string) : [],
        quotaViolations: [],
      }
      if (includeOverageEvents) {
        const overageData = await fetchOverageEvents(license.nonce as string, startTs, endTs)
        report.totalOverageCredits = overageData.totalOverageCredits
        report.overageCharges = overageData.totalCharges
        report.quotaViolations = overageData.violations
      }
      reports.push(report)
    }

    logger.info('[AgencyOS Sync] Sync completed', { agencyId, licenseCount: reports.length, durationMs: Date.now() - startTime })
    return NextResponse.json({ agencyId, periodStart: startDate, periodEnd: endDate, licenses: reports, syncTimestamp: new Date().toISOString(), metadata: { totalLicenses: licenses.length, totalCreditsUsed: reports.reduce((s, r) => s + r.totalCreditsUsed, 0), totalOverageCredits: reports.reduce((s, r) => s + r.totalOverageCredits, 0), totalOverageCharges: reports.reduce((s, r) => s + r.overageCharges, 0) } })
  } catch (error) {
    logger.error('[AgencyOS Sync] Sync failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Sync failed', code: 'SYNC_ERROR' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'agencyos-sync', timestamp: new Date().toISOString() })
}
