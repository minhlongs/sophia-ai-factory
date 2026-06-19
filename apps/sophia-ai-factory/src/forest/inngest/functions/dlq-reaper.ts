/**
 * DLQ Reaper — Inngest hourly cron that re-enqueues stale dead-letter entries.
 *
 * Runs every hour (cron: `0 * * * *`). Fetches DLQ entries older than 1 hour
 * that are still unresolved, attempts to re-enqueue each one by resetting
 * retry_count to 0. If re-enqueue fails, logs an alert.
 *
 * The actual re-processing happens on the next NOWPayments IPN callback —
 * this cron simply resets the gate so the handler can attempt again.
 *
 * @module forest/inngest/functions/dlq-reaper
 */

import { inngest } from '@/seed/inngest/client'
import { getD1 } from '@/seed/db/client'
import type { D1LikeClient } from '@/land/billing/nowpayments-ipn-dead-letter'
import { logger } from '@/seed/utils/logger-utility'
import { getStaleDlqEntries, reenqueueDlqEntry } from '@/land/billing/nowpayments-ipn-dead-letter'

const STALE_AGE_HOURS = 1
const MAX_REENQUEUE_ATTEMPTS = 3

export const dlqReaper = inngest.createFunction(
  { id: 'dlq-reaper', retries: 1 },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const stale = await step.run('fetch-stale-dlq', async () => {
      const _db = getD1();
      if (!_db) throw new Error('D1 database binding not available');
      const db = _db as unknown as D1LikeClient;
      return getStaleDlqEntries(db, STALE_AGE_HOURS)
    })

    if (stale.length === 0) {
      logger.info('[DLQReaper] No stale entries found')
      return { processed: 0, reenqueued: 0, alerts: 0 }
    }

    logger.info('[DLQReaper] Stale entries found', { count: stale.length })

    let reenqueued = 0
    let alerts = 0

    for (const entry of stale) {
      const result = await step.run(`reenqueue-${entry.event_id}`, async () => {
        const _db = getD1();
        if (!_db) throw new Error('D1 database binding not available');
        const db = _db as unknown as D1LikeClient;
        const ok = await reenqueueDlqEntry(db, entry.event_id)
        if (!ok) {
          logger.error('[DLQReaper] Re-enqueue failed — alert required', undefined, {
            eventId: entry.event_id,
            paymentId: entry.payment_id,
            retryCount: entry.retry_count,
            failureReason: entry.failure_reason,
          })
          return { status: 'failed' as const }
        }
        logger.info('[DLQReaper] Re-enqueued entry', {
          eventId: entry.event_id,
          paymentId: entry.payment_id,
          newRetryCount: 0,
        })
        return { status: 'ok' as const }
      })

      if (result.status === 'ok') reenqueued++
      else alerts++
    }

    logger.info('[DLQReaper] Run complete', {
      total: stale.length,
      reenqueued,
      alerts,
    })

    return { processed: stale.length, reenqueued, alerts }
  },
)
