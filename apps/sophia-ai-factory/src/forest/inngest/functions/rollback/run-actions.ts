import { inngest } from '@/seed/inngest/client'
import { sendInngestWithRetry } from '@/seed/inngest/send-with-retry'
import { logger } from '@/seed/utils/logger-utility'
import { isRetriesExhausted, isRetryDue } from '@/tree/mission/retry-backoff'
import type { D1Database, FailedRun, PolicyCaps, RowOutcome } from './types'
import { resolveMaxAutoRetries, parseInputJson } from './policy-loader'

export async function cancelExhaustedRun(
  db: D1Database,
  run: FailedRun,
  maxAutoRetries: number,
  nowMs: number,
): Promise<boolean> {
  const errorJson = JSON.stringify({
    code: 'RETRIES_EXHAUSTED',
    retryCount: run.retryCount,
    maxAutoRetries,
    lastError: run.errorMessage ?? null,
  })
  const updated = await db
    .prepare(
      `UPDATE agent_runs
       SET status = 'cancelled',
           phase = 'cancelled',
           error_json = ?,
           ended_at = ?
       WHERE id = ? AND status = 'failed'`,
    )
    .bind(errorJson, Math.floor(nowMs / 1000), run.id)
    .run()
  if (updated.meta.changes === 0) return false

  if (run.missionId) {
    try {
      const { markMissionFailed } = await import('../agent-mission-lifecycle')
      await markMissionFailed(run.missionId, 'RETRIES_EXHAUSTED')
    } catch (missionErr) {
      logger.warn('agentRollbackCron: failed to mark mission failed', {
        missionId: run.missionId,
        error: String(missionErr),
      })
    }
  }

  logger.info('agentRollbackCron: retries exhausted, run cancelled', {
    runId: run.id,
    retryCount: run.retryCount,
    maxAutoRetries,
  })
  return true
}

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

export async function processFailedRun(
  db: D1Database,
  run: FailedRun,
  caps: PolicyCaps,
  nowMs: number,
): Promise<RowOutcome> {
  const maxAutoRetries = resolveMaxAutoRetries(caps, run.workspaceId, run.missionType)

  if (isRetriesExhausted(run.retryCount, maxAutoRetries)) {
    const flipped = await cancelExhaustedRun(db, run, maxAutoRetries, nowMs)
    return flipped ? 'cancelled' : 'skipped'
  }

  const endedAtMs = run.endedAt === null ? 0 : run.endedAt * 1000
  if (!isRetryDue({ endedAt: endedAtMs, retryCount: run.retryCount, nowMs })) {
    return 'skipped'
  }

  if (!run.missionId) {
    logger.warn('agentRollbackCron: run has no mission_id, cannot retry', {
      runId: run.id,
    })
    return 'skipped'
  }

  const dispatched = await redispatchRun(db, run)
  return dispatched ? 'retried' : 'skipped'
}
