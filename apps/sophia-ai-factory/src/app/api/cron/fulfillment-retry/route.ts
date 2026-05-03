/**
 * Fulfillment Retry Cron
 *
 * Picks up videos stuck in status='queued' and retries HeyGen submission
 * with exponential backoff. Runs every 2 minutes via GitHub Actions.
 *
 * After MAX_ATTEMPTS failures:
 *   - marks video failed_permanent
 *   - grants +1 compensation credit to the user
 *   - sends bundle-render-failed email
 *
 * Auth: verifyCronAuth (CRON_SECRET or CF internal header)
 * Tracking: recordCronRun for observability
 *
 * @module app/api/cron/fulfillment-retry
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/seed/security/cron-auth'
import { recordCronRun } from '@/lib/cron/run-tracker'
import { getD1Raw, createServerClient } from '@/seed/db/client'
import { createHeyGenVideo } from '@/lib/video/heygen-helpers'
import { getHeyGenKey } from '@/tree/credentials/get-provider-key'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import {
  listQueuedForRetry,
  markVideoProcessing,
  recordAttemptCAS,
  markPermanentFailureCAS,
} from '@/seed/db/repositories/videos-repo'
import { MAX_ATTEMPTS, isRetryDue } from '@/lib/fulfillment/retry-backoff'
import { grantCompensationCredit } from '@/lib/fulfillment/compensation'
import { sendBundleRenderFailedEmail, type SendBundleRenderFailedInput } from '@/lib/billing/email/send-bundle-render-failed-email'
import { shouldDispatch, recordHeyGenAttempt } from '@/lib/fulfillment/circuit-breaker'

export const dynamic = 'force-dynamic'

const CRON_NAME = 'fulfillment-retry'
const BATCH_LIMIT = 20

interface UserEmailRow {
  email?: string
  locale?: string
}

async function fetchUserEmail(userId: string): Promise<{ email: string; locale: string } | null> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('user')
      .select('email, locale')
      .eq('id', userId)
      .single()
    const row = data as UserEmailRow | null
    if (!row?.email) return null
    return { email: row.email, locale: row.locale ?? 'vi' }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  let db: D1Database
  try {
    db = await getD1Raw()
  } catch (err) {
    logger.error('[fulfillment-retry] D1 unavailable', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'db_unavailable' }, { status: 500 })
  }

  const summary = { retried: 0, succeeded: 0, failed: 0, permanent: 0, skipped: 0, circuitBlocked: 0 }
  const now = Math.floor(Date.now() / 1000)

  // Check circuit breaker once per cron run — if open, skip all HeyGen attempts
  const dispatch = await shouldDispatch()
  if (!dispatch.allowed) {
    logger.warn('[fulfillment-retry] Circuit breaker blocked entire cron run', { reason: dispatch.reason })
    await recordCronRun(db, CRON_NAME, 'success')
    return NextResponse.json({ ok: true, ...summary, circuitBlocked: -1 })
  }

  try {
    const rows = await listQueuedForRetry(MAX_ATTEMPTS, BATCH_LIMIT)

    for (const row of rows) {
      // Skip rows not yet due based on backoff schedule
      if (!isRetryDue(row.attempt_count, row.last_attempt_at, now)) {
        summary.skipped++
        continue
      }

      summary.retried++

      // Per-row: resolve this user's HeyGen key (customer must have own key)
      const keyResult = await getHeyGenKey({ userId: row.user_id, fallbackToPlatform: false })
      if (!keyResult) {
        await recordAttemptCAS(row.id, 'no_user_heygen_key')
        summary.failed++
        continue
      }
      const rowApiKey = keyResult.key

      const script = row.script ?? ''
      const title = `Welcome Bundle — ${row.id.slice(0, 8)}`
      const callbackUrl =
        process.env.NODE_ENV === 'production'
          ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/heygen`
          : undefined

      try {
        const { videoId: heygenJobId } = await createHeyGenVideo({ script, title, apiKey: rowApiKey, callbackUrl })
        await markVideoProcessing(row.id, heygenJobId)
        try { await recordHeyGenAttempt(true) } catch { /* non-fatal */ }
        summary.succeeded++

        logger.info('[fulfillment-retry] Retry succeeded', {
          videoId: row.id,
          purchaseId: row.purchase_id,
          heygenJobId,
        })
      } catch (err) {
        const errMsg = getErrorMessage(err)
        const nextAttemptCount = row.attempt_count + 1
        try { await recordHeyGenAttempt(false) } catch { /* non-fatal */ }

        if (nextAttemptCount >= MAX_ATTEMPTS) {
          // M2 CAS: only the caller that wins the race sends email + compensation
          const won = await markPermanentFailureCAS(row.id, errMsg, nextAttemptCount - 1)
          if (!won) {
            logger.info('[fulfillment-retry] CAS lost — permanent failure already set', {
              videoId: row.id,
            })
            continue
          }

          summary.permanent++

          logger.warn('[fulfillment-retry] Permanent failure — compensating', {
            videoId: row.id,
            purchaseId: row.purchase_id,
            attempts: nextAttemptCount,
          })

          if (row.purchase_id) {
            await grantCompensationCredit(row.purchase_id, 'render_failed_permanent')

            const userInfo = await fetchUserEmail(row.user_id)
            const failedEmailInput: SendBundleRenderFailedInput = {
              userEmail: userInfo?.email,
              userId: row.user_id,
              purchaseId: row.purchase_id,
              locale: userInfo?.locale ?? row.locale ?? 'vi',
            }
            await sendBundleRenderFailedEmail(failedEmailInput)
          }
        } else {
          // M2 CAS: increment only if still in 'queued' state
          const newCount = await recordAttemptCAS(row.id, errMsg)
          if (newCount === null) {
            logger.info('[fulfillment-retry] CAS lost — row already transitioned, skipping', {
              videoId: row.id,
            })
            continue
          }
          summary.failed++

          logger.warn('[fulfillment-retry] Attempt failed', {
            videoId: row.id,
            purchaseId: row.purchase_id,
            attempt: newCount,
            error: errMsg,
          })
        }
      }
    }

    await recordCronRun(db, CRON_NAME, 'success')
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    const errMsg = getErrorMessage(err)
    logger.error('[fulfillment-retry] Cron run failed', err instanceof Error ? err : undefined)
    await recordCronRun(db, CRON_NAME, 'failure', errMsg)
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}
