import { inngest } from '@/seed/inngest/client'
import { sendInngestWithRetry } from '@/seed/inngest/send-with-retry'
import { logger } from '@/seed/utils/logger-utility'
import type { D1Database, FailedRun } from './types'
import { parseInputJson } from './policy-loader'

export async function redispatchRun(db: D1Database, run: FailedRun): Promise<boolean> {
  const updated = await db
    .prepare(
      `UPDATE agent_runs
       SET status = 'running', phase = 'retrying', retry_count = retry_count + 1
       WHERE id = ? AND status = 'failed'`,
    )
    .bind(run.id)
    .run()

  if (updated.meta.changes === 0) return false

  try {
    await sendInngestWithRetry(() =>
      inngest.send({
        name: 'agent.mission.started',
        data: {
          runId: run.id,
          agentId: run.agentId,
          missionId: run.missionId as string,
          workspaceId: run.workspaceId,
          autonomyLevel: run.autonomyLevel,
          inputJson: parseInputJson(run.inputJson),
        },
      }),
    )

    logger.info('agentRollbackCron: retrying run', {
      runId: run.id,
      agentId: run.agentId,
      attempt: run.retryCount + 1,
    })
    return true
  } catch (err) {
    logger.error('agentRollbackCron: redispatch send failed, reverting to failed', {
      runId: run.id,
      agentId: run.agentId,
      attempt: run.retryCount + 1,
      error: err instanceof Error ? err.message : String(err),
    })

    try {
      await db
        .prepare(
          `UPDATE agent_runs
           SET status = 'failed', phase = 'failed'
           WHERE id = ? AND status = 'running'`,
        )
        .bind(run.id)
        .run()
    } catch (revertErr) {
      logger.error('agentRollbackCron: failed to revert run status', {
        runId: run.id,
        error: String(revertErr),
      })
    }

    return false
  }
}
