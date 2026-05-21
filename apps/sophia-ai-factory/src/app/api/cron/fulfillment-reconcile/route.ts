/**
 * Daily Fulfillment Reconciliation Cron
 *
 * Detects drift between paid one-time purchases and delivered videos.
 * Runs daily at 06:00 UTC via GitHub Actions workflow.
 *
 * Logic:
 *   1. Find paid one-time purchases in last 24h (minus 2h in-flight buffer)
 *   2. Check which have no completed video ("orphans")
 *   3. If orphans found → logger.error + email to support@
 *
 * Auth: verifyCronAuth (CRON_SECRET header)
 * Tracking: recordCronRun
 *
 * @module app/api/cron/fulfillment-reconcile
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/seed/security/cron-auth'
import { recordCronRun } from '@/lib/cron/run-tracker'
import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { runReconcileQueries } from '@/lib/monitoring/reconcile-query'
import { sendReconcileAlert } from '@/lib/monitoring/reconcile-alert'
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in'

export const dynamic = 'force-dynamic'

const CRON_NAME = 'fulfillment-reconcile'
/** Purchases older than 24h */
const WINDOW_SEC = 24 * 60 * 60
/** Ignore purchases less than 2h old — still potentially in-flight */
const LAG_BUFFER_SEC = 2 * 60 * 60

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const cronCtx = startCronCheckIn(CRON_NAME)
  let db: D1Database
  try {
    db = await getD1Raw()
  } catch (err) {
    logger.error('[Reconcile] D1 unavailable', err instanceof Error ? err : undefined)
    failCronCheckIn(cronCtx, CRON_NAME, err)
    return NextResponse.json({ error: 'db_unavailable' }, { status: 500 })
  }

  const now = Math.floor(Date.now() / 1000)
  const since = now - WINDOW_SEC
  const before = now - LAG_BUFFER_SEC

  try {
    const result = await runReconcileQueries(db, since, before)

    const summary = {
      ok: result.orphanCount === 0,
      paidPurchases: result.paidCount,
      delivered: result.deliveredCount,
      orphans: result.orphanCount,
      permanentFailed: result.permanentFailCount,
      windowStart: new Date(since * 1000).toISOString(),
      windowEnd: new Date(before * 1000).toISOString(),
    }

    if (result.orphanCount > 0) {
      logger.error('[Reconcile] Orphan purchases detected — paid but no video delivered', undefined, {
        orphanCount: result.orphanCount,
        permanentFailCount: result.permanentFailCount,
        paidCount: result.paidCount,
      })

      for (const orphan of result.orphans) {
        logger.error('[Reconcile] Orphan purchase detail', undefined, {
          purchaseId: orphan.id,
          sku: orphan.sku,
        })
      }

      // Send alert email to support (non-blocking)
      sendReconcileAlert(result).catch((alertErr) => {
        logger.error('[Reconcile] Alert email failed', alertErr instanceof Error ? alertErr : undefined)
      })
    }

    await recordCronRun(db, CRON_NAME, result.orphanCount > 0 ? 'failure' : 'success')
    if (result.orphanCount > 0) {
      failCronCheckIn(cronCtx, CRON_NAME, new Error(`${result.orphanCount} orphan purchases detected`))
    } else {
      finishCronCheckIn(cronCtx, CRON_NAME)
    }
    return NextResponse.json(summary)
  } catch (err) {
    const errMsg = getErrorMessage(err)
    logger.error('[Reconcile] Cron run failed', err instanceof Error ? err : undefined)
    await recordCronRun(db, CRON_NAME, 'failure', errMsg)
    failCronCheckIn(cronCtx, CRON_NAME, err)
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}
