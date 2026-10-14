/**
 * Synthetic Monitor Cron — smoke-one-time
 * @module app/api/cron/smoke-one-time
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/seed/security/cron-auth'
import { recordCronRun } from '@/land/cron/run-tracker'
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in'
import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import {
  CRON_NAME,
  runSmokePhaseACheck,
  runSmokePhaseBCreate,
} from './smoke-one-time-helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (process.env.SYNTHETIC_ENABLED === 'false') {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }

  const authError = verifyCronAuth(req)
  if (authError) return authError

  const cronCtx = startCronCheckIn(CRON_NAME)
  let db: D1Database
  try {
    const _db = await getD1()
    if (!_db) throw new Error('D1 database binding not available')
    db = _db
  } catch (err) {
    logger.error('[smoke-one-time] D1 unavailable', err instanceof Error ? err : undefined)
    failCronCheckIn(cronCtx, CRON_NAME, err)
    return NextResponse.json({ error: 'db_unavailable' }, { status: 500 })
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const alertFired = await runSmokePhaseACheck(db, nowSec)

  try {
    const created = await runSmokePhaseBCreate(db)
    if (!created) {
      logger.warn('[smoke-one-time] Failed to insert synthetic purchase')
      await recordCronRun(db, CRON_NAME, 'failure', 'insert_purchase_failed')
      failCronCheckIn(cronCtx, CRON_NAME, new Error('insert_purchase_failed'))
      return NextResponse.json({ ok: false, error: 'insert_purchase_failed' }, { status: 500 })
    }
  } catch (err) {
    logger.warn('[smoke-one-time] Phase B create failed (non-fatal)', {
      error: getErrorMessage(err),
    })
  }

  await recordCronRun(db, CRON_NAME, alertFired ? 'failure' : 'success')

  if (alertFired) {
    failCronCheckIn(cronCtx, CRON_NAME, new Error('synthetic fulfillment stale alert fired'))
  } else {
    finishCronCheckIn(cronCtx, CRON_NAME)
  }

  return NextResponse.json({
    ok: !alertFired,
    alertFired,
    checkedAt: new Date().toISOString(),
  })
}
