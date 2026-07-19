/**
 * DLQ Reaper — Inngest hourly cron.
 *
 * Responsibilities:
 * 1. Re-enqueue stale unresolved entries (resolved=0, last_attempted_at > 1h ago),
 *    but ONLY if they haven't hit MAX_DLQ_RETRIES. Exhausted entries are marked
 *    resolved=2 instead of being re-enqueued forever.
 * 2. Retention cleanup — delete resolved=1 rows older than 30 days and
 *    resolved=2 rows older than 90 days in batches of 500.
 * 3. Alerting — warn when unresolved count > 100; critical when exhausted rate > 20%.
 *
 * @module forest/inngest/functions/dlq-reaper
 */

import { inngest } from '@/seed/inngest/client'
import { getD1 } from '@/seed/db/client'
import type { D1LikeClient } from '@/land/billing/nowpayments-ipn-dead-letter'
import {
  getStaleDlqEntries,
  reenqueueDlqEntry,
  markDlqExhausted,
  getOldResolvedDlq,
  getOldExhaustedDlq,
  deleteDlqEntries,
  getDlqHealth,
  MAX_DLQ_RETRIES,
  DLQ_WARN_SIZE,
  EXHAUSTED_WARN_RATE,
  RESOLVED_RETENTION_DAYS,
  EXHAUSTED_RETENTION_DAYS,
  RETENTION_BATCH_SIZE,
} from '@/land/billing/nowpayments-ipn-dead-letter'
import { logger } from '@/seed/utils/logger-utility'

const STALE_AGE_HOURS = 1

export const dlqReaper = inngest.createFunction(
  { id: 'dlq-reaper', retries: 1 },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const _db = getD1()
    if (!_db) throw new Error('D1 database binding not available')
    const db = _db as unknown as D1LikeClient

    // -----------------------------------------------------------------------
    // 0. Health + alerting (run first, before any mutations)
    // -----------------------------------------------------------------------
    const health = await step.run('dlq-health', async () => getDlqHealth(db))

    if (health.warnSize) {
      logger.warn('[DLQReaper] DLQ size threshold exceeded', {
        unresolvedCount: health.unresolvedCount,
        threshold: DLQ_WARN_SIZE,
      })
    }

    if (health.criticalExhaustedRate) {
      logger.error('[DLQReaper] Exhausted DLQ rate critical', {
        exhaustedCount: health.exhaustedCount,
        unresolvedCount: health.unresolvedCount,
        rate: Math.round(health.exhaustedRate * 100) / 100,
        threshold: EXHAUSTED_WARN_RATE,
      })
    }

    // -----------------------------------------------------------------------
    // 1. Re-enqueue stale unresolved entries
    // -----------------------------------------------------------------------
    const stale = await step.run('fetch-stale-dlq', async () =>
      getStaleDlqEntries(db, STALE_AGE_HOURS),
    )

    if (stale.length === 0) {
      logger.info('[DLQReaper] No stale entries found')
    } else {
      logger.info('[DLQReaper] Stale entries found', { count: stale.length })
    }

    let reenqueued = 0
    let exhausted = 0
    let alerts = 0

    for (const entry of stale) {
      const result = await step.run(
        `process-${entry.event_id}`,
        async () => {
          // If already at or past MAX_DLQ_RETRIES, escalate to exhausted.
          if (entry.retry_count >= MAX_DLQ_RETRIES) {
            await markDlqExhausted(db, entry.event_id)
            return { status: 'exhausted' as const }
          }

          const ok = await reenqueueDlqEntry(db, entry.event_id)
          if (!ok) {
            return { status: 'failed' as const }
          }
          return { status: 'ok' as const }
        },
      )

      if (result.status === 'ok') reenqueued++
      else if (result.status === 'exhausted') exhausted++
      else alerts++
    }

    // -----------------------------------------------------------------------
    // 2. Retention cleanup — resolved=1 (30d) and resolved=2 (90d)
    // -----------------------------------------------------------------------
    let resolvedDeleted = 0
    let exhaustedDeleted = 0

    const oldResolved = await step.run('fetch-old-resolved', async () =>
      getOldResolvedDlq(db, RESOLVED_RETENTION_DAYS, RETENTION_BATCH_SIZE),
    )
    if (oldResolved.length > 0) {
      const ids = oldResolved.map((r) => r.event_id)
      resolvedDeleted = await step.run('delete-old-resolved', async () =>
        deleteDlqEntries(db, ids),
      )
    }

    const oldExhausted = await step.run('fetch-old-exhausted', async () =>
      getOldExhaustedDlq(db, EXHAUSTED_RETENTION_DAYS, RETENTION_BATCH_SIZE),
    )
    if (oldExhausted.length > 0) {
      const ids = oldExhausted.map((r) => r.event_id)
      exhaustedDeleted = await step.run('delete-old-exhausted', async () =>
        deleteDlqEntries(db, ids),
      )
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    const summary = {
      processed: stale.length,
      reenqueued,
      exhausted,
      alerts,
      retention: {
        resolvedScanned: oldResolved.length,
        resolvedDeleted,
        exhaustedScanned: oldExhausted.length,
        exhaustedDeleted,
      },
      health: {
        unresolvedCount: health.unresolvedCount,
        exhaustedCount: health.exhaustedCount,
        exhaustedRate: Math.round(health.exhaustedRate * 100) / 100,
      },
    }

    logger.info('[DLQReaper] Run complete', summary)

    return summary
  },
)
