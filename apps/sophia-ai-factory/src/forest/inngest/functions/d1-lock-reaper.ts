/**
 * D1 Lock Reaper
 *
 * Scans `payment_events` for stale unprocessed locks (created >5 minutes ago)
 * and marks them recovered via `markForRecovery`. Intended to run as an Inngest
 * scheduled job or HTTP cron — logs a terminal summary when finished.
 *
 * Output format:
 *   `D1 lock reaper done: processed={n}, recovered={m}, degraded={k}, errors={l}`
 *
 * @module forest/inngest/functions/d1-lock-reaper
 */

import { createServerClient } from '@/seed/db/client'
import { markForRecovery, type StaleLockDatabase } from '@/seed/utils/stale-lock-recovery'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'

/** Run the reaper once and return summary counters. */
export async function runD1LockReaper(): Promise<{ processed: number; recovered: number; degraded: number; errors: number }> {
  const loggerContext = 'forest/inngest/d1-lock-reaper'
  const reaperLogger = logger.child(loggerContext)

  const db = createServerClient()
  let processed = 0
  let recovered = 0
  let degraded = 0
  let errors = 0

  try {
    const candidates = await db
      .prepare(
        `SELECT event_id FROM payment_events
         WHERE processed = 0 AND created_at < datetime('now', '-5 minutes')
         LIMIT 50`,
      )
      .all<{ event_id: string }>()

    processed = candidates.results?.length ?? 0

    for (const row of candidates.results ?? []) {
      const recovery = await markForRecovery(db as StaleLockDatabase, row.event_id)
      if (!recovery.ok) {
        reaperLogger.warn('[D1LockReaper] Recovery failed', { eventId: row.event_id, error: recovery.error })
        errors += 1
        continue
      }

      if (recovery.value) {
        recovered += 1
      } else {
        degraded += 1
      }
    }
  } catch (error) {
    reaperLogger.error('[D1LockReaper] Fatal scan failure', toError(error))
    errors += 1
  }

  const summary = { processed, recovered, degraded, errors }
  reaperLogger.info(`D1 lock reaper done: processed=${processed}, recovered=${recovered}, degraded=${degraded}, errors=${errors}`, summary)
  return summary
}

export default runD1LockReaper