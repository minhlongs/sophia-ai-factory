/**
 * Inngest Cron: Market Signals Ingestion
 * Runs hourly — fetches market signals from configured sources per workspace.
 * Layer: forest/inngest/functions/market-signals
 */

import { inngest } from '@/seed/inngest/client'
import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import type { WorkspaceSourceConfigRow } from './types'
import { ingestWorkspaceSource } from './workspace-source-ingester'

export const marketSignalsIngestCron = inngest.createFunction(
  { id: 'market-signals-ingest', retries: 2 },
  { cron: '0 * * * *' }, // Hourly at minute 0
  async ({ step }) => {
    // Step 1: Fetch all workspaces with configured market signal sources
    const workspaceConfigs = await step.run('fetch-workspace-configs', async () => {
      const _db = await getD1()
      if (!_db) {
        logger.error('[market-signals-ingest] D1 not available', { reason: 'd1_binding_missing' })
        return []
      }
      const db = _db
      try {
        const { results } = await db
          .prepare(
            `SELECT workspace_id, source, config_json
             FROM workspace_market_signal_configs
             WHERE enabled = 1`
          )
          .all<WorkspaceSourceConfigRow>()
        return results ?? []
      } catch (err) {
        logger.warn('[market-signals-ingest] Failed to read workspace signal configs (table may not exist yet)', {
          error: err instanceof Error ? err.message : String(err),
        })
        return []
      }
    })

    if (workspaceConfigs.length === 0) {
      logger.info('[market-signals-ingest] No workspace sources configured', { reason: 'no_sources_configured' })
      return { ingested: 0, workspaces: 0, skipped: true, reason: 'no_sources_configured' }
    }

    // Group by workspace
    const byWorkspace = new Map<string, WorkspaceSourceConfigRow[]>()
    for (const config of workspaceConfigs) {
      const arr = byWorkspace.get(config.workspace_id) ?? []
      arr.push(config)
      byWorkspace.set(config.workspace_id, arr)
    }

    let totalIngested = 0
    let workspacesProcessed = 0
    const errors: Array<{ workspaceId: string; source: string; error: string }> = []

    // Step 2: Process each workspace (per-workspace error isolation)
    for (const [workspaceId, configs] of byWorkspace.entries()) {
      const workspaceResult = await step.run(`process-workspace-${workspaceId}`, async () => {
        let workspaceIngested = 0
        const workspaceErrors: string[] = []

        for (const config of configs) {
          try {
            const outcome = await ingestWorkspaceSource(workspaceId, config)
            workspaceIngested += outcome.ingested
            workspaceErrors.push(...outcome.errors)
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err)
            workspaceErrors.push(`${config.source}: ${errorMsg}`)
            logger.error('[market-signals-ingest] Source fetch failed', {
              workspaceId,
              source: config.source,
              error: errorMsg,
            })
          }
        }

        return { ingested: workspaceIngested, errors: workspaceErrors }
      })

      totalIngested += workspaceResult.ingested
      workspacesProcessed++
      if (workspaceResult.errors.length > 0) {
        errors.push(...workspaceResult.errors.map((e) => ({ workspaceId, source: e.split(':')[0], error: e })))
      }
    }

    // Step 3: Cleanup expired signals (global, non-fatal)
    await step.run('cleanup-expired', async () => {
      try {
        const { deleteExpiredSignals } = await import('@/tree/market-signals/store')
        const result = await deleteExpiredSignals()
        if (result.ok && result.value > 0) {
          logger.info('[market-signals-ingest] Cleaned up expired signals', { deleted: result.value })
        }
      } catch (err) {
        logger.warn('[market-signals-ingest] Cleanup failed (non-fatal)', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })

    logger.info('[market-signals-ingest] Completed', {
      totalIngested,
      workspacesProcessed,
      errorCount: errors.length,
    })

    return {
      ingested: totalIngested,
      workspaces: workspacesProcessed,
      errors: errors.length > 0 ? errors : undefined,
    }
  },
)
