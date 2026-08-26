/**
 * Inngest Cron: Market Signals Ingestion
 * Runs hourly — fetches market signals from configured sources per workspace.
 * Dedupes by (source, title-hash, day-window) using upsertSignalDeduped.
 * Per-workspace error isolation — never throws globally.
 *
 * Layer: forest (infrastructure orchestration)
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  fetchMultiRegionTrending,
  type YouTubeSourceConfig,
} from '@/tree/market-signals/sources/youtube-source';
import {
  fetchMultiRegionTrends,
  type SourceResult,
} from '@/tree/market-signals/sources/rss-source';
import { upsertSignalDeduped } from '@/tree/market-signals/store';

interface WorkspaceSourceConfigRow {
  workspace_id: string;
  source: string; // 'youtube' | 'google-trends-rss'
  config_json: string; // JSON with regionCode, userId (for youtube), maxSignals, etc.
}

interface SourceFetchConfig {
  workspaceId: string;
  userId?: string; // Required for YouTube BYOK
  regionCode?: string;
  categoryId?: string;
  maxSignals?: number;
}

const DEFAULT_MAX_SIGNALS = 25;
const DEFAULT_REGION = 'US';

export const marketSignalsIngestCron = inngest.createFunction(
  { id: 'market-signals-ingest', retries: 2 },
  { cron: '0 * * * *' }, // Hourly at minute 0
  async ({ step }) => {
    // Step 1: Fetch all workspaces with configured market signal sources
    const workspaceConfigs = await step.run('fetch-workspace-configs', async () => {
      const _db = await getD1();
      if (!_db) {
        logger.error('[market-signals-ingest] D1 not available', { reason: 'd1_binding_missing' });
        return [];
      }
      const db = _db;
      try {
        const { results } = await db
          .prepare(
            `SELECT workspace_id, source, config_json
             FROM workspace_market_signal_configs
             WHERE enabled = 1`
          )
          .all<WorkspaceSourceConfigRow>();
        return results ?? [];
      } catch (err) {
        // Table does not exist until the config writer/UI feature ships
        // (no migration yet by design). Treat any read failure as "no configs"
        // so the cron exits cleanly instead of burning hourly retries.
        logger.warn('[market-signals-ingest] Failed to read workspace signal configs (table may not exist yet)', {
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    });

    if (workspaceConfigs.length === 0) {
      logger.info('[market-signals-ingest] No workspace sources configured', { reason: 'no_sources_configured' });
      return { ingested: 0, workspaces: 0, skipped: true, reason: 'no_sources_configured' };
    }

    // Group by workspace
    const byWorkspace = new Map<string, WorkspaceSourceConfigRow[]>();
    for (const config of workspaceConfigs) {
      const arr = byWorkspace.get(config.workspace_id) ?? [];
      arr.push(config);
      byWorkspace.set(config.workspace_id, arr);
    }

    let totalIngested = 0;
    let workspacesProcessed = 0;
    const errors: Array<{ workspaceId: string; source: string; error: string }> = [];

    // Step 2: Process each workspace (per-workspace error isolation)
    for (const [workspaceId, configs] of byWorkspace.entries()) {
      const workspaceResult = await step.run(`process-workspace-${workspaceId}`, async () => {
        let workspaceIngested = 0;
        const workspaceErrors: string[] = [];

        for (const config of configs) {
          try {
            const outcome = await ingestWorkspaceSource(workspaceId, config);
            workspaceIngested += outcome.ingested;
            workspaceErrors.push(...outcome.errors);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            workspaceErrors.push(`${config.source}: ${errorMsg}`);
            logger.error('[market-signals-ingest] Source fetch failed', {
              workspaceId,
              source: config.source,
              error: errorMsg,
            });
          }
        }

        return { ingested: workspaceIngested, errors: workspaceErrors };
      });

      totalIngested += workspaceResult.ingested;
      workspacesProcessed++;
      if (workspaceResult.errors.length > 0) {
        errors.push(...workspaceResult.errors.map(e => ({ workspaceId, source: e.split(':')[0], error: e })));
      }
    }

    // Step 3: Cleanup expired signals (global, non-fatal)
    await step.run('cleanup-expired', async () => {
      try {
        const { deleteExpiredSignals } = await import('@/tree/market-signals/store');
        const result = await deleteExpiredSignals();
        if (result.ok && result.value > 0) {
          logger.info('[market-signals-ingest] Cleaned up expired signals', { deleted: result.value });
        }
      } catch (err) {
        logger.warn('[market-signals-ingest] Cleanup failed (non-fatal)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    logger.info('[market-signals-ingest] Completed', {
      totalIngested,
      workspacesProcessed,
      errorCount: errors.length,
    });

    return {
      ingested: totalIngested,
      workspaces: workspacesProcessed,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Outcome of routing one workspace source config to its adapter. */
type SourceDispatch =
  | { kind: 'result'; result: SourceResult }
  | { kind: 'blocked'; reason: string; logMessage: string };

/**
 * Dispatch to the appropriate source adapter based on source type.
 * YouTube requires a BYOK user id — without one the adapter would have no
 * customer credential to use, so skip with an explicit blocked reason
 * instead of calling out.
 */
async function dispatchSource(
  config: WorkspaceSourceConfigRow,
  fetchConfig: SourceFetchConfig,
): Promise<SourceDispatch> {
  switch (config.source) {
    case 'youtube': {
      if (!fetchConfig.userId) {
        return { kind: 'blocked', reason: 'BYOK_REQUIRED', logMessage: '[market-signals-ingest] Missing BYOK userId for youtube source' };
      }
      const ytConfig: YouTubeSourceConfig = { ...fetchConfig, userId: fetchConfig.userId };
      return { kind: 'result', result: await fetchMultiRegionTrending(ytConfig) };
    }
    case 'google-trends-rss':
      return { kind: 'result', result: await fetchMultiRegionTrends(fetchConfig) };
    default:
      return { kind: 'blocked', reason: 'UNKNOWN_SOURCE', logMessage: '[market-signals-ingest] Unknown source type' };
  }
}

/** Upsert signals with dedupe, collecting per-signal failures (never throws). */
async function upsertSourceSignals(
  source: string,
  signals: SourceResult['signals'],
): Promise<{ ingested: number; errors: string[] }> {
  let ingested = 0;
  const errors: string[] = [];
  for (const signal of signals) {
    const upsertResult = await upsertSignalDeduped(signal);
    if (upsertResult.ok) {
      ingested++;
    } else {
      errors.push(`${source}: upsert_failed_${signal.id}`);
      logger.error('[market-signals-ingest] Upsert failed', {
        source,
        signalId: signal.id,
        error: upsertResult.error.message,
      });
    }
  }
  return { ingested, errors };
}

/** Fetch + persist one configured source for one workspace. */
async function ingestWorkspaceSource(
  workspaceId: string,
  config: WorkspaceSourceConfigRow,
): Promise<{ ingested: number; errors: string[] }> {
  const fetchConfig = buildFetchConfig(config);
  const dispatch = await dispatchSource(config, fetchConfig);

  if (dispatch.kind === 'blocked') {
    logger.warn(dispatch.logMessage, { workspaceId, source: config.source });
    return { ingested: 0, errors: [`${config.source}: ${dispatch.reason}`] };
  }

  if (dispatch.result.blockedReason) {
    logger.warn('[market-signals-ingest] Source blocked', {
      workspaceId,
      source: config.source,
      reason: dispatch.result.blockedReason,
    });
    return { ingested: 0, errors: [`${config.source}: ${dispatch.result.blockedReason}`] };
  }

  if (dispatch.result.signals.length === 0) {
    return { ingested: 0, errors: [] };
  }

  const outcome = await upsertSourceSignals(config.source, dispatch.result.signals);
  logger.info('[market-signals-ingest] Source ingested', {
    workspaceId,
    source: config.source,
    count: outcome.ingested,
  });
  return outcome;
}

function buildFetchConfig(config: WorkspaceSourceConfigRow): SourceFetchConfig {
  let parsedConfig: Record<string, unknown> = {};
  try {
    parsedConfig = JSON.parse(config.config_json) as Record<string, unknown>;
  } catch {
    logger.warn('[market-signals-ingest] Invalid config_json', {
      workspaceId: config.workspace_id,
      source: config.source,
    });
  }

  return {
    workspaceId: config.workspace_id,
    userId: parsedConfig.userId as string | undefined,
    regionCode: (parsedConfig.regionCode as string) ?? DEFAULT_REGION,
    categoryId: parsedConfig.categoryId as string | undefined,
    maxSignals: (parsedConfig.maxSignals as number) ?? DEFAULT_MAX_SIGNALS,
  };
}

// Re-export for testing
export { buildFetchConfig };