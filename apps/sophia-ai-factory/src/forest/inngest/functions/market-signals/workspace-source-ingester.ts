/**
 * Workspace Source Ingestion & Dispatch
 * Layer: forest/inngest/functions/market-signals
 */

import { logger } from '@/seed/utils/logger-utility'
import {
  fetchMultiRegionTrending,
  type YouTubeSourceConfig,
} from '@/tree/market-signals/sources/youtube-source'
import {
  fetchMultiRegionTrends,
  type SourceResult,
} from '@/tree/market-signals/sources/rss-source'
import { upsertSignalDeduped } from '@/tree/market-signals/store'
import {
  DEFAULT_MAX_SIGNALS,
  DEFAULT_REGION,
  type SourceFetchConfig,
  type WorkspaceSourceConfigRow,
} from './types'

/** Outcome of routing one workspace source config to its adapter. */
export type SourceDispatch =
  | { kind: 'result'; result: SourceResult }
  | { kind: 'blocked'; reason: string; logMessage: string }

/**
 * Dispatch to the appropriate source adapter based on source type.
 * YouTube requires a BYOK user id — without one the adapter would have no
 * customer credential to use, so skip with an explicit blocked reason
 * instead of calling out.
 */
export async function dispatchSource(
  config: WorkspaceSourceConfigRow,
  fetchConfig: SourceFetchConfig,
): Promise<SourceDispatch> {
  switch (config.source) {
    case 'youtube': {
      if (!fetchConfig.userId) {
        return {
          kind: 'blocked',
          reason: 'BYOK_REQUIRED',
          logMessage: '[market-signals-ingest] Missing BYOK userId for youtube source',
        }
      }
      const ytConfig: YouTubeSourceConfig = { ...fetchConfig, userId: fetchConfig.userId }
      return { kind: 'result', result: await fetchMultiRegionTrending(ytConfig) }
    }
    case 'google-trends-rss':
      return { kind: 'result', result: await fetchMultiRegionTrends(fetchConfig) }
    default:
      return {
        kind: 'blocked',
        reason: 'UNKNOWN_SOURCE',
        logMessage: '[market-signals-ingest] Unknown source type',
      }
  }
}

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

export function buildFetchConfig(config: WorkspaceSourceConfigRow): SourceFetchConfig {
  let parsedConfig: Record<string, unknown> = {}
  try {
    parsedConfig = JSON.parse(config.config_json) as Record<string, unknown>
  } catch {
    logger.warn('[market-signals-ingest] Invalid config_json', {
      workspaceId: config.workspace_id,
      source: config.source,
    })
  }

  return {
    workspaceId: config.workspace_id,
    userId: parsedConfig.userId as string | undefined,
    regionCode: (parsedConfig.regionCode as string) ?? DEFAULT_REGION,
    categoryId: parsedConfig.categoryId as string | undefined,
    maxSignals: (parsedConfig.maxSignals as number) ?? DEFAULT_MAX_SIGNALS,
  }
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
