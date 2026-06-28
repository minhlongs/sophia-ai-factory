/**
 * Usage Export Cron Endpoint — GET /api/cron/usage-export
 * Schedule: 5 * * * * (hourly at :05)
 * @module app/api/cron/usage-export/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { getPreviousDayRange } from './cron-usage-export-helpers'
import { verifyCronAuth } from '@/seed/security/cron-auth'
import { getActiveLicenses } from './cron-usage-export-db'
import { processLicenseExport } from './cron-usage-export-processor'
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker'
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in'

const CRON_NAME = 'usage-export'
/** Hourly — skip if ran within last 30 minutes */
const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
    if (env?.DB) return env.DB as D1Database
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
    return globalDb ?? null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME)
  const db = getD1()

  if (db && await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME)
    return NextResponse.json({ status: 'ok', idempotent: true, skipped: 'recent_run' })
  }

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
      if (db) await recordCronRun(db, CRON_NAME, 'success')
      return NextResponse.json({ status: 'ok', idempotent: false, message: 'No active licenses to process', processed: 0, failed: 0, totalRecords: 0 })
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

    if (db) await recordCronRun(db, CRON_NAME, failedCount > 0 ? 'failure' : 'success')

    if (failedCount > 0) {
      failCronCheckIn(cronCtx, CRON_NAME, new Error(`${failedCount} license exports failed`))
    } else {
      finishCronCheckIn(cronCtx, CRON_NAME)
    }

    return NextResponse.json({
      status: 'ok',
      idempotent: false,
      message: `Processed ${activeLicenses.length - failedCount}/${activeLicenses.length} licenses`,
      processed: activeLicenses.length - failedCount, failed: failedCount, totalRecords, duration, results,
    })
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    const duration = Date.now() - startTime
    logger.error('[Usage Export Cron] Critical error', error instanceof Error ? error : new Error(String(error)), { requestId, duration })
    if (db) await recordCronRun(db, CRON_NAME, 'failure', errorMessage)
    failCronCheckIn(cronCtx, CRON_NAME, error)
    return NextResponse.json({ status: 'error', idempotent: false, error: errorMessage, requestId })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
