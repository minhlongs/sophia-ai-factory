import { inngest } from '@/seed/inngest/client'
import { logger } from '@/seed/utils/logger-utility'
import { getD1 } from '@/seed/db/client'
import { SCAN_LIMIT, type FailedRun } from './types'
import { loadPolicyCaps } from './policy-loader'
import { processFailedRun } from './run-actions'

export const agentRollbackCron = inngest.createFunction(
  {
    id: 'agent-rollback-cron',
    retries: 0,
  },
  { cron: '*/5 * * * *' },
  async () => {
    logger.info('agentRollbackCron: starting scan')

    const db = await getD1()
    if (!db) {
      logger.error('agentRollbackCron: D1 not available')
      return { scanned: 0, retried: 0, cancelled: 0 }
    }

    const caps = await loadPolicyCaps(db)
    const nowMs = Date.now()

    const rows = await db
      .prepare(
        `SELECT r.id,
                r.agent_id       AS agentId,
                r.mission_id     AS missionId,
                r.workspace_id   AS workspaceId,
                r.autonomy_level AS autonomyLevel,
                r.retry_count    AS retryCount,
                r.ended_at       AS endedAt,
                r.error_message  AS errorMessage,
                r.input_json     AS inputJson,
                m.mission_type   AS missionType
         FROM agent_runs r
         LEFT JOIN creative_missions m ON m.id = r.mission_id
         WHERE r.status = 'failed'
         ORDER BY r.ended_at ASC
         LIMIT ?`,
      )
      .bind(SCAN_LIMIT)
      .all<FailedRun>()

    const failedRuns = rows.results ?? []

    logger.info('agentRollbackCron: scan complete', { found: failedRuns.length })

    let retried = 0
    let cancelled = 0
    for (const run of failedRuns) {
      try {
        const outcome = await processFailedRun(db, run, caps, nowMs)
        if (outcome === 'retried') retried += 1
        else if (outcome === 'cancelled') cancelled += 1
      } catch (err) {
        logger.error('agentRollbackCron: failed to process run', {
          runId: run.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return { scanned: failedRuns.length, retried, cancelled }
  },
)
