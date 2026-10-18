/**
 * Workspace Source Ingestion & Dispatch
 * Layer: forest/inngest/functions/market-signals
 */

import { logger } from '@/seed/utils/logger-utility'
import type { SourceResult } from '@/tree/market-signals/sources/rss-source'
import { upsertSignalDeduped } from '@/tree/market-signals/store'
import type { WorkspaceSourceConfigRow } from './types'
import {
  dispatchSource,
  buildFetchConfig,
  type SourceDispatch,
} from './workspace-source-router'

export { dispatchSource, buildFetchConfig, type SourceDispatch }

/** Upsert signals with dedupe, collecting per-signal failures (never throws). */
export async function upsertSourceSignals(
  source: string,
  signals: SourceResult['signals'],
): Promise<{ ingested: number; errors: string[] }> {
  let ingested = 0
  const errors: string[] = []
  for (const signal of signals) {
    const upsertResult = await upsertSignalDeduped(signal)
    if (upsertResult.ok) {
      ingested++
    } else {
      errors.push(`${source}: upsert_failed_${signal.id}`)
      logger.error('[market-signals-ingest] Upsert failed', {
        source,
        signalId: signal.id,
        error: upsertResult.error.message,
      })
    }
  }
  return { ingested, errors }
}

/** Fetch + persist one configured source for one workspace. */
export async function ingestWorkspaceSource(
  workspaceId: string,
  config: WorkspaceSourceConfigRow,
): Promise<{ ingested: number; errors: string[] }> {
  const fetchConfig = buildFetchConfig(config)
  const dispatch = await dispatchSource(config, fetchConfig)

  if (dispatch.kind === 'blocked') {
    logger.warn(dispatch.logMessage, { workspaceId, source: config.source })
    return { ingested: 0, errors: [`${config.source}: ${dispatch.reason}`] }
  }

  if (dispatch.result.blockedReason) {
    logger.warn('[market-signals-ingest] Source blocked', {
      workspaceId,
      source: config.source,
      reason: dispatch.result.blockedReason,
    })
    return { ingested: 0, errors: [`${config.source}: ${dispatch.result.blockedReason}`] }
  }

  if (dispatch.result.signals.length === 0) {
    return { ingested: 0, errors: [] }
  }

  const outcome = await upsertSourceSignals(config.source, dispatch.result.signals)
  logger.info('[market-signals-ingest] Source ingested', {
    workspaceId,
    source: config.source,
    count: outcome.ingested,
  })
  return outcome
}
