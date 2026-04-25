/**
 * Usage Export Cron Endpoint — GET /api/cron/usage-export
 * Schedule: 0 2 * * * (02:00 UTC daily)
 * @module app/api/cron/usage-export/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import { verifyCronAuth, getPreviousDayRange } from './cron-usage-export-helpers'
import { getActiveLicenses } from './cron-usage-export-db'
import { processLicenseExport } from './cron-usage-export-processor'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    logger.info('[Usage Export Cron] Starting', { requestId })
    const { startTimestamp, endTimestamp } = getPreviousDayRange()
    logger.info('[Usage Export Cron] Date range', {
      startTimestamp, endTimestamp,
      startDate: new Date(startTimestamp * 1000).toISOString(),
      endDate: new Date(endTimestamp * 1000).toISOString(),
    })

    const activeLicenses = await getActiveLicenses()
    if (activeLicenses.length === 0) {
      logger.info('[Usage Export Cron] No active licenses found')
      return NextResponse.json({ success: true, message: 'No active licenses to process', processed: 0, failed: 0, totalRecords: 0 })
    }

    const results: Array<{ nonce: string; tier: string; success: boolean; recordCount: number; errorMessage?: string }> = []
    let totalRecords = 0
    let failedCount = 0

    for (const license of activeLicenses) {
      const result = await processLicenseExport(license, startTimestamp, endTimestamp)
      results.push({ nonce: license.nonce.slice(0, 8), tier: license.tier, success: result.success, recordCount: result.recordCount, errorMessage: result.errorMessage })
      totalRecords += result.recordCount
      if (!result.success) failedCount++
    }

    const duration = Date.now() - startTime
    logger.info('[Usage Export Cron] Complete', { requestId, duration, totalLicenses: activeLicenses.length, successful: activeLicenses.length - failedCount, failed: failedCount, totalRecords })

    return NextResponse.json({
      success: true,
      message: `Processed ${activeLicenses.length - failedCount}/${activeLicenses.length} licenses`,
      processed: activeLicenses.length - failedCount, failed: failedCount, totalRecords, duration, results,
    })
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    const duration = Date.now() - startTime
    logger.error('[Usage Export Cron] Critical error', error instanceof Error ? error : new Error(String(error)), { requestId, duration })
    return NextResponse.json({ success: false, error: errorMessage, requestId }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
