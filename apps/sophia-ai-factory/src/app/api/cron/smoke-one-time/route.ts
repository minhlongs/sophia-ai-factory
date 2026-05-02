/**
 * Synthetic Monitor Cron — smoke-one-time
 *
 * Two-phase design (fits within CF Workers CPU budget):
 *   Phase A — CHECK: look for any synthetic purchase created >10min ago that
 *             has no completed video → alert ops (fulfillment is broken).
 *   Phase B — CREATE: insert a new synthetic purchase and trigger fulfillment
 *             so the next run can check it.
 *
 * Schedule: every 15 minutes ("*&#47;15 * * * *")
 * Auth: verifyCronAuth
 *
 * Synthetic artifacts are cleaned up after alerting, or after a matching
 * synthetic run that passes Phase A.
 *
 * @module app/api/cron/smoke-one-time
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/security/cron-auth'
import { recordCronRun } from '@/lib/cron/run-tracker'
import { getD1Raw } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import { triggerOneTimeFulfillment } from '@/lib/fulfillment/one-time-fulfillment'
import { insertPurchase, markPaid } from '@/lib/db/repositories/user-purchases-repo'
import { cleanupSyntheticArtifacts } from '@/lib/monitoring/synthetic-cleanup'
import { sendSlackAlert } from '@/lib/monitoring/slack-alert'

export const dynamic = 'force-dynamic'

const CRON_NAME = 'smoke-one-time'
const SYNTHETIC_USER_ID = '00000000-0000-0000-0000-000000000001'
/** Purchase older than this threshold without a completed video triggers an alert */
const STALE_THRESHOLD_SEC = 10 * 60

interface SyntheticCheckRow {
  id: string
  payment_id: string
  created_at: number
}

interface VideoStatusRow {
  status: string
  id: string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Allow env override to disable during staging without removing the schedule
  if (process.env.SYNTHETIC_ENABLED === 'false') {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }

  const authError = verifyCronAuth(req)
  if (authError) return authError

  let db: D1Database
  try {
    db = await getD1Raw()
  } catch (err) {
    logger.error('[smoke-one-time] D1 unavailable', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'db_unavailable' }, { status: 500 })
  }

  const nowSec = Math.floor(Date.now() / 1000)
  let alertFired = false

  // ── Phase A: Check pending synthetic purchases ─────────────────────────────

  try {
    const staleRows = await db
      .prepare(
        `SELECT id, payment_id, created_at
         FROM user_purchases
         WHERE user_id = ?1
           AND payment_id LIKE 'SYNTHETIC_%'
           AND status = 'paid'
           AND created_at < ?2`,
      )
      .bind(SYNTHETIC_USER_ID, nowSec - STALE_THRESHOLD_SEC)
      .all<SyntheticCheckRow>()

    for (const purchase of staleRows.results ?? []) {
      const videoRow = await db
        .prepare(
          `SELECT id, status FROM videos
           WHERE purchase_id = ?1 AND status = 'completed'
           LIMIT 1`,
        )
        .bind(purchase.id)
        .first<VideoStatusRow>()

      if (!videoRow) {
        const ageMin = Math.round((nowSec - purchase.created_at) / 60)
        alertFired = true

        logger.error('[smoke-one-time] Synthetic fulfillment stale — alerting', undefined, {
          purchaseId: purchase.id,
          ageMinutes: ageMin,
        })

        await sendSlackAlert('high', `Synthetic fulfillment STALE after ${ageMin}min`, {
          purchaseId: purchase.id,
          ageMinutes: ageMin,
          environment: process.env.NODE_ENV ?? 'unknown',
        })
      }

      // Clean up regardless (stale rows accumulate otherwise)
      await cleanupSyntheticArtifacts(purchase.id)
    }
  } catch (err) {
    logger.warn('[smoke-one-time] Phase A check failed', { error: getErrorMessage(err) })
  }

  // ── Phase B: Create new synthetic purchase for next-run check ─────────────

  try {
    const paymentId = `SYNTHETIC_${crypto.randomUUID()}`
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 365 * 24 * 60 * 60 // 1 year

    const purchaseId = await insertPurchase({
      userId: SYNTHETIC_USER_ID,
      kind: 'one_time',
      sku: 'STARTER_BUNDLE',
      paymentId,
      amountCents: 0,
      creditsTotal: 1,
      expiresAt,
      status: 'pending',
    })

    if (!purchaseId) {
      logger.warn('[smoke-one-time] Failed to insert synthetic purchase')
      await recordCronRun(db, CRON_NAME, 'failure', 'insert_purchase_failed')
      return NextResponse.json({ ok: false, error: 'insert_purchase_failed' }, { status: 500 })
    }

    // Mark as paid so fulfillment proceeds
    await markPaid(paymentId, 1, expiresAt)

    // Trigger fulfillment (non-throwing — errors are logged internally)
    await triggerOneTimeFulfillment(SYNTHETIC_USER_ID, purchaseId, {
      id: 'STARTER_BUNDLE',
      invoiceId: '0000000000',
      priceUsd: 0,
      credits: 1,
      ttlMonths: 12,
      label_vi: 'Synthetic',
      label_en: 'Synthetic',
    })

    logger.info('[smoke-one-time] Synthetic purchase triggered', { purchaseId, paymentId })
  } catch (err) {
    logger.warn('[smoke-one-time] Phase B create failed (non-fatal)', {
      error: getErrorMessage(err),
    })
  }

  await recordCronRun(db, CRON_NAME, alertFired ? 'failure' : 'success')

  return NextResponse.json({
    ok: !alertFired,
    alertFired,
    checkedAt: new Date().toISOString(),
  })
}
